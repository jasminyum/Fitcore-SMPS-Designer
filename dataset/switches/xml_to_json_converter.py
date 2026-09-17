# example code for plecs switching devices xml to json

import glob
import json
import os
import xml.etree.ElementTree as ET

CURVATURE_THRESHOLD = 5.0
ABS_FLOOR = 1e-9


def _check_and_fix_row(values, i_axis, context_label, autocorrect, warnings, threshold=CURVATURE_THRESHOLD):
    n = len(values)
    corrected = list(values)
    if n < 3 or not i_axis or len(i_axis) != n:
        return corrected, 0

    row_scale = max((abs(v) for v in values), default=ABS_FLOOR) or ABS_FLOOR
    floor = max(ABS_FLOOR, 1e-4 * row_scale)

    d_list = [i_axis[k] - i_axis[k - 1] for k in range(1, n)]
    abs_d = sorted(abs(d) for d in d_list if d != 0)
    typical_dI = abs_d[len(abs_d) // 2] if abs_d else 0.0

    def _is_regular(dI):
        if typical_dI <= 0: return True
        return 0.5 * typical_dI <= abs(dI) <= 2.0 * typical_dI

    reg_positions = [k for k in range(1, n) if
                     i_axis[k] - i_axis[k - 1] != 0 and _is_regular(i_axis[k] - i_axis[k - 1])]
    raw_slope = {}
    for k in reg_positions:
        dI = i_axis[k] - i_axis[k - 1]
        raw_slope[k] = (values[k] - values[k - 1]) / dI

    WINDOW = 3
    flagged_positions = {}
    pos_index = {k: idx for idx, k in enumerate(reg_positions)}
    for k in reg_positions:
        idx = pos_index[k]
        window_positions = reg_positions[max(0, idx - WINDOW):idx] + reg_positions[idx + 1:idx + 1 + WINDOW]
        window_slopes = [raw_slope[p] for p in window_positions]
        if len(window_slopes) < 3: continue

        sw = sorted(window_slopes)
        m = len(sw)
        median = sw[m // 2] if m % 2 == 1 else (sw[m // 2 - 1] + sw[m // 2]) / 2.0
        abs_devs = sorted(abs(s - median) for s in window_slopes)
        mad = abs_devs[len(abs_devs) // 2] if abs_devs[len(abs_devs) // 2] else abs_devs[-1]

        dI = i_axis[k] - i_axis[k - 1]
        significant = abs(values[k]) > floor or abs(values[k - 1]) > floor
        if not significant: continue

        mad_floor = max(mad, floor / max(typical_dI, ABS_FLOOR))
        deviation = abs(raw_slope[k] - median)
        if deviation > threshold * mad_floor:
            flagged_positions[k] = median

    flagged = 0
    for k in range(1, n):
        if k not in flagged_positions:
            corrected[k] = values[k]
            continue
        flagged += 1
        dI = i_axis[k] - i_axis[k - 1]
        median_slope = flagged_positions[k]
        fixed_val = corrected[k - 1] + median_slope * dI
        i_val = i_axis[k]
        ratio = abs(raw_slope[k]) / max(abs(median_slope), ABS_FLOOR)
        msg = (f"[ŞÜPHELİ HÜCRE] {context_label} | I_idx={k} (I={i_val}): "
               f"değer={values[k]:.6g}, çevresel eğim medyanından beklenen={fixed_val:.6g} "
               f"(eğim oranı {ratio:.1f}x, eşik={threshold}x)")
        if warnings is not None:
            warnings.append(msg)
        if autocorrect:
            corrected[k] = fixed_val
        else:
            corrected[k] = values[k]

    return corrected, flagged


def _validate_and_fix_matrix(parsed_data, label_prefix, autocorrect, warnings):
    matrix = parsed_data.get('values')
    if not matrix: return 0

    i_axis = parsed_data.get('i')
    t_axis = parsed_data.get('T')
    v_axis = parsed_data.get('v')
    total_flagged = 0

    if v_axis:
        for ti, t_block in enumerate(matrix):
            t_val = t_axis[ti] if t_axis and ti < len(t_axis) else ti
            for vi, row in enumerate(t_block):
                v_val = v_axis[vi] if vi < len(v_axis) else vi
                label = f"{label_prefix} T={t_val} V={v_val}"
                fixed_row, flagged = _check_and_fix_row(row, i_axis, label, autocorrect, warnings)
                t_block[vi] = fixed_row
                total_flagged += flagged
    else:
        for ti, row in enumerate(matrix):
            t_val = t_axis[ti] if t_axis and ti < len(t_axis) else ti
            label = f"{label_prefix} T={t_val}"
            fixed_row, flagged = _check_and_fix_row(row, i_axis, label, autocorrect, warnings)
            matrix[ti] = fixed_row
            total_flagged += flagged

    return total_flagged


def get_local_tag(elem):
    if elem is None:
        return ""
    return elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag


def find_elements_by_tag(root, tag_name):
    if root is None: return []
    return [e for e in root.iter() if get_local_tag(e) == tag_name]


def get_child_by_tag(node, tag_name):
    if node is None: return None
    for child in node:
        if get_local_tag(child) == tag_name:
            return child
    return None


def parse_loss_matrix(node, dataset_type_hint=None, label_prefix="", autocorrect=True, warnings=None):
    if node is None:
        return []

    parsed_data = {}

    for axis_name, key in [("CurrentAxis", "i"), ("VoltageAxis", "v"), ("TemperatureAxis", "T")]:
        axis = get_child_by_tag(node, axis_name)
        if axis is not None and axis.text:
            parsed_data[key] = [float(x) for x in axis.text.split()]

    val_node = get_child_by_tag(node, "Energy")
    is_energy = val_node is not None
    if val_node is None:
        val_node = get_child_by_tag(node, "VoltageDrop")

    if val_node is None:
        return []

    parsed_data['dataset_type'] = dataset_type_hint or ("graph_i_e" if is_energy else "graph_v_i")
    scale = float(val_node.get('scale', 1.0))
    matrix = []

    for t_elem in val_node:
        if get_local_tag(t_elem) != "Temperature":
            continue

        v_elems = [e for e in t_elem if get_local_tag(e) == "Voltage"]
        if v_elems:
            t_arr = []
            for v_elem in v_elems:
                if v_elem.text:
                    t_arr.append([float(x) * scale for x in v_elem.text.split()])
            if t_arr:
                matrix.append(t_arr)
        else:
            if t_elem.text:
                matrix.append([float(x) * scale for x in t_elem.text.split()])

    parsed_data['values'] = matrix
    flagged = _validate_and_fix_matrix(parsed_data, label_prefix, autocorrect, warnings)
    if flagged and warnings is not None:
        warnings.append(f"  >> {label_prefix}: toplam {flagged} şüpheli hücre düzeltildi/işaretlendi.")

    return [parsed_data]


def parse_thermal_rc(root):
    r_th, c_th = [], []
    branches = find_elements_by_tag(root, "Branch")
    for branch in branches:
        for rc in branch:
            if get_local_tag(rc) == "RCElement":
                r_th.append(float(rc.get('R', 0)))
                c_th.append(float(rc.get('C', 0)))
    return r_th, c_th


def convert_single_xml(xml_file, folder_name="", autocorrect=True):
    filename = os.path.basename(xml_file)

    base_name = os.path.splitext(filename)[0]
    partnumber = base_name.replace("-plecs", "").replace("_Thermal", "")

    tree = ET.parse(xml_file)
    root = tree.getroot()

    v_max, i_max = 650.0, 0.0

    packages = find_elements_by_tag(root, "Package")
    pkg_node = packages[0] if packages else None

    pkg_class = pkg_node.get('class', '') if pkg_node is not None else ""
    is_pure_diode = "diode" in pkg_class.lower() and "mosfet" not in pkg_class.lower() and "igbt" not in pkg_class.lower()

    for var in find_elements_by_tag(root, "Variable"):
        n_elem = get_child_by_tag(var, "Name")
        v_elem = get_child_by_tag(var, "MaxValue")
        if n_elem is not None and v_elem is not None:
            if n_elem.text == 'v': v_max = float(v_elem.text)
            if n_elem.text == 'i': i_max = float(v_elem.text)

    r_th, c_th = parse_thermal_rc(root)
    file_warnings = []
    switch_channel, diode_channel = [], []

    e_on_nodes = find_elements_by_tag(root, "TurnOnLoss")
    e_on_node = e_on_nodes[0] if e_on_nodes else None
    parsed_e_on = parse_loss_matrix(e_on_node, label_prefix=f"{partnumber}.e_on", autocorrect=autocorrect,
                                    warnings=file_warnings) if e_on_node is not None else []

    e_off_nodes = find_elements_by_tag(root, "TurnOffLoss")
    e_off_node = e_off_nodes[0] if e_off_nodes else None
    parsed_e_off = parse_loss_matrix(e_off_node, label_prefix=f"{partnumber}.e_off", autocorrect=autocorrect,
                                     warnings=file_warnings) if e_off_node is not None else []

    for cond in find_elements_by_tag(root, "ConductionLoss"):
        gate_state = cond.get("gate")

        if is_pure_diode:
            diode_channel = parse_loss_matrix(cond, label_prefix=f"{partnumber}.diode.channel", autocorrect=autocorrect,
                                              warnings=file_warnings)
        else:
            if gate_state == "on":
                switch_channel = parse_loss_matrix(cond, label_prefix=f"{partnumber}.switch.channel",
                                                   autocorrect=autocorrect, warnings=file_warnings)
            elif gate_state == "off":
                diode_channel = parse_loss_matrix(cond, label_prefix=f"{partnumber}.diode.channel",
                                                  autocorrect=autocorrect,
                                                  warnings=file_warnings)

    if is_pure_diode:
        transistor_dict = {
            "name": partnumber,
            "type": folder_name,
            "author": "XML_Parser",
            "manufacturer": pkg_node.get('vendor', 'Wolfspeed') if pkg_node is not None else "Wolfspeed",
            "housing_area": 1.0,
            "cooling_area": 1.0,
            "r_g_int": 0.0,
            "housing_type": "unknown",
            "r_th_cs": 0.0,
            "r_th_switch_cs": 0.0,
            "r_th_diode_cs": 0.0,
            "v_abs_max": v_max,
            "i_abs_max": i_max,
            "i_cont": i_max,
            "diode": {
                "thermal_foster": {"r_th_vector": r_th, "c_th_vector": c_th},
                "channel": diode_channel,
                "e_on": parsed_e_on,
                "e_off": parsed_e_off,
                "soa": []
            },
            "switch": {
                "thermal_foster": {"r_th_vector": [], "c_th_vector": []},
                "channel": [],
                "r_channel_th": [],
                "e_on": [],
                "e_off": [],
                "soa": []
            },
            "soa": {}
        }
    else:
        transistor_dict = {
            "name": partnumber,
            "type": folder_name,
            "author": "XML_Parser",
            "manufacturer": pkg_node.get('vendor', 'Wolfspeed') if pkg_node is not None else "Wolfspeed",
            "housing_area": 1.0,
            "cooling_area": 1.0,
            "r_g_int": 0.0,
            "housing_type": "unknown",
            "r_th_cs": 0.0,
            "r_th_switch_cs": 0.0,
            "r_th_diode_cs": 0.0,
            "v_abs_max": v_max,
            "i_abs_max": i_max,
            "i_cont": i_max,
            "diode": {
                "thermal_foster": {"r_th_vector": r_th, "c_th_vector": c_th},
                "channel": diode_channel,
                "soa": []
            },
            "switch": {
                "thermal_foster": {"r_th_vector": r_th, "c_th_vector": c_th},
                "channel": switch_channel,
                "r_channel_th": [],
                "e_on": parsed_e_on,
                "e_off": parsed_e_off,
                "soa": []
            },
            "soa": {}
        }

    return partnumber, transistor_dict, file_warnings


def convert_all_xml_to_json(base_directory, autocorrect=True):
    target_path = os.path.join(base_directory, "all_transistors_json")
    if not os.path.exists(target_path):
        os.makedirs(target_path)

    search_pattern = os.path.join(base_directory, "**", "*.xml")
    xml_files = glob.glob(search_pattern, recursive=True)

    print(f"Toplam {len(xml_files)} adet XML dosyası bulundu.")
    print(f"Yeni JSON'lar şu klasöre kaydedilecek: {target_path}\n")

    basarili, hatali, toplam_supheli = 0, 0, 0

    for xml_file in xml_files:
        filename = os.path.basename(xml_file)
        try:
            folder_name = os.path.basename(os.path.dirname(xml_file))
            partnumber, transistor_dict, file_warnings = convert_single_xml(xml_file, folder_name,
                                                                            autocorrect=autocorrect)

            json_file_path = os.path.join(target_path, f"{partnumber}.json")
            with open(json_file_path, "w", encoding="utf-8") as jf:
                json.dump(transistor_dict, jf, indent=2, ensure_ascii=False)

            basarili += 1
            print(f"[{basarili}] Başarılı: {partnumber}.json OLUŞTURULDU")

            if file_warnings:
                toplam_supheli += 1
                warn_path = os.path.join(target_path, f"{partnumber}.warnings.log")
                with open(warn_path, "w", encoding="utf-8") as wf:
                    wf.write("\n".join(file_warnings))
                print(f"    !! Şüpheli hücre uyarısı loglandı -> {warn_path}")

        except Exception as e:
            hatali += 1
            print(f"HATA: {filename} işlenirken bir sorun oluştu! JSON yazılamadı. Detay: {e}")

    print(f"\n--- OK ---")
    print(f"Başarılı: {basarili} | Hatalı: {hatali} | Uyarı İçerenler: {toplam_supheli}")
    print(f"Yeni JSON dosyalarınız tam olarak burada: {target_path}")


if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    BASE_DIR = os.path.join(current_dir, "plescc")
    if os.path.exists(BASE_DIR):
        convert_all_xml_to_json(BASE_DIR, autocorrect=True)
    else:
        print(f"Hata: {BASE_DIR} bulunamadı.")