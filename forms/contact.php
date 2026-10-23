<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\SMTP;

require 'phpmailler/src/Exception.php';
require 'phpmailler/src/PHPMailer.php';
require 'phpmailler/src/SMTP.php';

if ($_POST) {
    $name = $_POST['name'];
    $email = $_POST['email'];
    $subject = $_POST['subject'];
    $message = $_POST['message'];

    // Mail içeriği
    $icerik = "<h2>New message!</h2> <br>";
    $icerik .= "Adı ve Soyadı: $name <br>";
    $icerik .= "E-Posta: $email <br>";
    $icerik .= "Konu: $subject <br>";
    $icerik .= "Mesaj: $message <br>";

    $mail = new PHPMailer(true);
    try {
        $mail->SetLanguage("tr", "phpmailler/language/");
        $mail->CharSet = "utf-8";
        $mail->Encoding = "base64";

        $mail->SMTPDebug = SMTP::DEBUG_OFF;
        $mail->isSMTP();
        $mail->Host = "smtp.xxx.com";
        $mail->SMTPAuth = true;
        $mail->Username = "mail";
        $mail->Password = "pass";
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port = 465;

        $mail->setFrom('mail', 'ADMIN');

        $mail->addAddress("user");

        $mail->isHTML(true);
        $mail->Subject = 'Sitenize Öneri ve Şikayet Talebi!';
        $mail->Body    = $icerik;
        $mail->AltBody = strip_tags($icerik);

        $mail->send();
        echo "OK";
    } catch (Exception $e) {
        echo "Mail gönderilirken hata oluştu: {$mail->ErrorInfo}";
    }
}
?>
