package com.platform.portal.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MailService {

    private final JavaMailSender mailSender;

    @Value("${app.site-url:https://rsp-work-potal.vercel.app}")
    private String siteUrl;

    public void sendInitialCredentials(String toEmail, String username, String tempPassword) {
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setTo(toEmail);
        msg.setSubject("[플랫폼팀 업무 포탈] 계정이 생성되었습니다");
        msg.setText(
            "안녕하세요,\n\n" +
            "플랫폼팀 업무 포탈 계정이 생성되었습니다.\n\n" +
            "아이디: " + username + "\n" +
            "임시 비밀번호: " + tempPassword + "\n\n" +
            "아래 링크로 접속하여 로그인 후 비밀번호를 변경해 주세요.\n" +
            siteUrl + "\n\n" +
            "감사합니다."
        );
        mailSender.send(msg);
    }
}
