(function() {
  "use strict";

  /**
   * Easy selector helper function
   */
  const select = (el, all = false) => {
    el = el.trim()
    if (all) {
      return [...document.querySelectorAll(el)]
    } else {
      return document.querySelector(el)
    }
  }

  /**
   * Easy event listener function
   */
  const on = (type, el, listener, all = false) => {
    let selectEl = select(el, all)
    if (selectEl) {
      if (all) {
        selectEl.forEach(e => e.addEventListener(type, listener))
      } else {
        selectEl.addEventListener(type, listener)
      }
    }
  }

  /**
   * Easy on scroll event listener 
   */
  const onscroll = (el, listener) => {
    el.addEventListener('scroll', listener)
  }

  /**
   * Navbar links active state on scroll
   */
  let navbarlinks = select('#navbar .scrollto', true)
  const navbarlinksActive = () => {
    let position = window.scrollY + 300
    navbarlinks.forEach(navbarlink => {
      if (!navbarlink.hash) return
      let section = select(navbarlink.hash)
      if (!section) return
      if (position >= section.offsetTop && position <= (section.offsetTop + section.offsetHeight)) {
        navbarlink.classList.add('active')
      } else {
        navbarlink.classList.remove('active')
      }
    })
  }
  window.addEventListener('load', navbarlinksActive)
  onscroll(document, navbarlinksActive)

  /**
   * Scrolls to an element with header offset
   */
  const scrollto = (el) => {
    let header = select('#header')
    let offset = header.offsetHeight

    let elementPos = select(el).offsetTop
    window.scrollTo({
      top: elementPos - offset,
      behavior: 'smooth'
    })
  }

  /**
   * Header fixed top on scroll
   */
  let selectHeader = select('#header')
  if (selectHeader) {
    let headerOffset = selectHeader.offsetTop
    let nextElement = selectHeader.nextElementSibling
    const headerFixed = () => {
      if ((headerOffset - window.scrollY) <= 0) {
        selectHeader.classList.add('fixed-top')
        nextElement.classList.add('scrolled-offset')
      } else {
        selectHeader.classList.remove('fixed-top')
        nextElement.classList.remove('scrolled-offset')
      }
    }
    window.addEventListener('load', headerFixed)
    onscroll(document, headerFixed)
  }

  /**
   * Back to top button
   */
  let backtotop = select('.back-to-top')
  if (backtotop) {
    const toggleBacktotop = () => {
      if (window.scrollY > 100) {
        backtotop.classList.add('active')
      } else {
        backtotop.classList.remove('active')
      }
    }
    window.addEventListener('load', toggleBacktotop)
    onscroll(document, toggleBacktotop)
  }

  /**
   * Mobile nav toggle
   */
  on('click', '.mobile-nav-toggle', function(e) {
    select('#navbar').classList.toggle('navbar-mobile')
    this.classList.toggle('bi-list')
    this.classList.toggle('bi-x')
  })

  /**
   * Mobile nav dropdowns activate
   */
  on('click', '.navbar .dropdown > a', function(e) {
    if (select('#navbar').classList.contains('navbar-mobile')) {
      e.preventDefault()
      this.nextElementSibling.classList.toggle('dropdown-active')
    }
  }, true)

  /**
   * Scrool with ofset on links with a class name .scrollto
   */
  on('click', '.scrollto', function(e) {
    if (select(this.hash)) {
      e.preventDefault()

      let navbar = select('#navbar')
      if (navbar.classList.contains('navbar-mobile')) {
        navbar.classList.remove('navbar-mobile')
        let navbarToggle = select('.mobile-nav-toggle')
        navbarToggle.classList.toggle('bi-list')
        navbarToggle.classList.toggle('bi-x')
      }
      scrollto(this.hash)
    }
  }, true)

  /**
   * Scroll with ofset on page load with hash links in the url
   */
  window.addEventListener('load', () => {
    if (window.location.hash) {
      if (select(window.location.hash)) {
        scrollto(window.location.hash)
      }
    }
  });

  /**
   * Preloader
   */
  let preloader = select('#preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        preloader.remove()
      }, 100);
    });
  }

  /**
     const typed = select('.typed')
  if (typed) {
    let typed_strings = typed.getAttribute('data-typed-items')
    typed_strings = typed_strings.split(',')
    new Typed('.typed', {
      strings: typed_strings,
      loop: true,
      typeSpeed: 100,
      backSpeed: 50,
      backDelay: 2000
    });
  }
   */

  /**
   * Porfolio isotope and filter
   */
  window.addEventListener('load', () => {
    let portfolioContainer = select('.portfolio-container');
    if (portfolioContainer) {
      let portfolioIsotope = new Isotope(portfolioContainer, {
        itemSelector: '.portfolio-item',
        layoutMode: 'fitRows'
      });

      let portfolioFilters = select('#portfolio-flters li', true);

      on('click', '#portfolio-flters li', function(e) {
        e.preventDefault();
        portfolioFilters.forEach(function(el) {
          el.classList.remove('filter-active');
        });
        this.classList.add('filter-active');

        portfolioIsotope.arrange({
          filter: this.getAttribute('data-filter')
        });
        aos_init();
      }, true);
    }

  });

  /**
   * Initiate portfolio lightbox 
   */
  const portfolioLightbox = GLightbox({
    selector: '.portfolio-lightbox'
  });

  /**
   * Portfolio details slider
   */
  new Swiper('.portfolio-details-slider', {
    speed: 400,
    loop: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false
    },
    pagination: {
      el: '.swiper-pagination',
      type: 'bullets',
      clickable: true
    }
  });

  /**
   * Animation on scroll
   */
  function aos_init() {
    AOS.init({
      duration: 1000,
      easing: "ease-in-out",
      once: true,
      mirror: false
    });
  }
  window.addEventListener('load', () => {
    aos_init();
  });

})()

function showModeInfo() {
    const lang = document.documentElement.lang || 'tr';

    const translations = {
        tr: {
            title: "Mod Se\u00e7imi Hakk\u0131nda Bilgi",
            stdTitle: "Standart Mod",
            stdDesc: "H\u0131zl\u0131 hesaplamalar i\u00e7in idealdir. Temel sar\u0131m ve end\u00fcktans parametrelerini matematiksel form\u00fcllerle belirler. N\u00fcve kay\u0131plar\u0131n\u0131 (Core Loss) hesaplamaz.",
            advTitle: "Advanced Mod (Yapay Zeka Optimizasyonu)",
            advDesc: "Profesyonel m\u00fchendislik modudur. Firebase veritaban\u0131na ba\u011flanarak ger\u00e7ek stoklu bile\u015fenleri se\u00e7er.",
            fuzzy: "Bulan\u0131k Mant\u0131k:",
            fuzzyDesc: "Maliyet, verim ve boyutu optimize eder.",
            core: "N\u00fcve Kay\u0131plar\u0131:",
            coreDesc: "Steinmetz denklemleriyle ger\u00e7ek \u0131s\u0131 kay\u0131plar\u0131n\u0131 hesaplar.",
            skin: "Deri Etkisi:",
            skinDesc: "Frekansa g\u00f6re Litz teli \u00f6nerir.",
            leakage: "Ka\u00e7ak Analizi:",
            leakageDesc: "Ka\u00e7ak end\u00fcktans\u0131 tahmin eder ve snubber \u00f6nerir.",
            warn: "* Advanced Mod'u kullanmak i\u00e7in \u00f6nce 'Hesapla' butonuna basman\u0131z gerekir.",
            btn: "Tamam"
        },
        en: {
            title: "Mode Selection Information",
            stdTitle: "Standard Mode",
            stdDesc: "Ideal for fast calculations. Uses mathematical formulas to determine basic winding and inductance parameters. Does not calculate core losses.",
            advTitle: "Advanced Mode (AI Optimization)",
            advDesc: "Professional engineering mode. It connects to the Firebase database and selects real stock components.",
            fuzzy: "Fuzzy Logic:",
            fuzzyDesc: "Balances cost, efficiency, and size.",
            core: "Core Loss:",
            coreDesc: "Calculates real heat losses using Steinmetz equations.",
            skin: "Skin Effect:",
            skinDesc: "Suggests Litz wire based on frequency.",
            leakage: "Leakage Analysis:",
            leakageDesc: "Estimates leakage inductance and suggests snubber values.",
            warn: "* You must click 'Calculate' first to enable Advanced Mode.",
            btn: "OK"
        },
        de: {
            title: "Informationen zur Moduswahl",
            stdTitle: "Standardmodus",
            stdDesc: "Ideal f&uuml;r schnelle Berechnungen. Verwendet mathematische Formeln zur Bestimmung grundlegender Wicklungs- und Induktivit&auml;tsparameter. Berechnet keine Kernverluste (Core Loss).",
            advTitle: "Erweiterter Modus (KI-Optimierung)",
            advDesc: "Professioneller Engineering-Modus. Er verbindet sich mit der Firebase-Datenbank und w&auml;hlt reale Lagerkomponenten aus.",
            fuzzy: "Fuzzy-Logik:",
            fuzzyDesc: "Optimiert Kosten, Effizienz und Gr&ouml;&szlig;e.",
            core: "Kernverluste:",
            coreDesc: "Berechnet reale W&auml;rmeverluste mit Steinmetz-Gleichungen.",
            skin: "Skineffekt:",
            skinDesc: "Empfiehlt Litzenraht basierend auf der Frequenz.",
            leakage: "Streuinduktivit&auml;tsanalyse:",
            leakageDesc: "Sch&auml;tzt die Streuinduktivit&auml;t und schl&auml;gt Snubber-Werte vor.",
            warn: "* Sie m&uuml;ssen zuerst auf 'Berechnen' klicken, um den erweiterten Modus zu aktivieren.",
            btn: "Verstanden"
        }
    };

    const t = translations[lang] || translations['tr'];

    const content = `
        <div style="text-align: left; font-family: 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6;">
            <h6 style="color: #00AEEF; border-bottom: 1px solid #444; padding-bottom: 5px; font-weight: bold;">${t.stdTitle}</h6>
            <p>${t.stdDesc}</p>
            
            <h6 style="color: #81c784; border-bottom: 1px solid #444; padding-bottom: 5px; margin-top: 15px; font-weight: bold;">${t.advTitle}</h6>
            <p>${t.advDesc}</p>
            <ul style="padding-left: 20px; margin-bottom: 10px;">
                <li><b>${t.fuzzy}</b> ${t.fuzzyDesc}</li>
                <li><b>${t.core}</b> ${t.coreDesc}</li>
                <li><b>${t.skin}</b> ${t.skinDesc}</li>
                <li><b>${t.leakage}</b> ${t.leakageDesc}</li>
            </ul>
            <p style="font-style: italic; color: #ffb74d; margin-top: 10px; font-size: 12px;">
                ${t.warn}
            </p>
        </div>
    `;

    const infoModal = document.createElement('div');
    infoModal.id = 'customInfoModal';
    infoModal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;";

    infoModal.innerHTML = `
        <div style="background: #1e1e1e; color: #e0e0e0; padding: 25px; border-radius: 12px; max-width: 550px; width: 100%; border: 1px solid #444; box-shadow: 0 15px 35px rgba(0,0,0,0.6); position: relative; animation: fadeIn 0.3s ease;">
            <h4 style="margin-top: 0; color: #fff; border-bottom: 2px solid #3f51b5; padding-bottom: 10px;">${t.title}</h4>
            <div style="margin-top: 20px;">${content}</div>
            <button onclick="document.getElementById('customInfoModal').remove()" style="margin-top: 20px; width: 100%; padding: 12px; background: #3f51b5; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold; transition: background 0.2s;">${t.btn}</button>
        </div>
        <style>
            @keyframes fadeIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        </style>
    `;
    document.body.appendChild(infoModal);
}