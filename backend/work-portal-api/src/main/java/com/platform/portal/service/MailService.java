package com.platform.portal.service;

import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MailService {

    private final JavaMailSender mailSender;

    public void sendInitialCredentials(String toEmail, String username, String tempPassword) {
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setTo(toEmail);
        msg.setSubject("[플랫폼팀 업무 포탈] 계정이 생성되었습니다");
        msg.setText(
            "안녕하세요,\n\n" +
            "플랫폼팀 업무 포탈 계정이 생성되었습니다.\n\n" +
            "아이디: " + username + "\n" +
            "임시 비밀번호: " + tempPassword + "\n\n" +
            "최초 로그인 후 반드시 비밀번호를 변경해 주세요.\n\n" +
            "감사합니다."
        );
        mailSender.send(msg);
    }
}
