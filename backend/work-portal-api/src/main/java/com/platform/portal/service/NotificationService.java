package com.platform.portal.service;

import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final WebexService webexService;
    private final UserRepository userRepository;

    @Value("${app.site-url:https://rsp-work-potal.vercel.app}")
    private String siteUrl;

    /**
     * 특정 이메일 목록에게 DM 발송
     */
    public int sendDirect(List<String> emails, String message) {
        int sent = 0;
        for (String email : emails) {
            if (email != null && !email.isBlank()) {
                webexService.sendDirectMessage(email, message);
                sent++;
            }
        }
        return sent;
    }

    /**
     * 전체 활성 팀원(MEMBER/MANAGER/ADMIN)에게 DM 발송
     */
    public int sendToAll(String message) {
        List<String> emails = userRepository.findAll().stream()
                .filter(u -> u.isActive() && u.getRole() != User.Role.EXTERNAL && u.getEmail() != null && !u.getEmail().isBlank())
                .map(User::getEmail)
                .toList();
        return sendDirect(emails, message);
    }

    /**
     * 공용 룸에 공지 발송
     */
    public void sendToRoom(String message) {
        String roomId = webexService.getDefaultRoomId();
        webexService.sendRoomMessage(roomId, message);
    }

    /**
     * 특정 사용자(username 기준)에게 DM 발송
     */
    public int sendToUsernames(List<String> usernames, String message) {
        List<String> emails = userRepository.findAll().stream()
                .filter(u -> usernames.contains(u.getUsername()) && u.getEmail() != null && !u.getEmail().isBlank())
                .map(User::getEmail)
                .toList();
        return sendDirect(emails, message);
    }
}
