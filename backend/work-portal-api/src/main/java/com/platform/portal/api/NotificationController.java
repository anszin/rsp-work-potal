package com.platform.portal.api;

import com.platform.portal.service.NotificationService;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
public class NotificationController {

    private final NotificationService notificationService;

    @PostMapping("/send")
    public ResponseEntity<Map<String, Object>> send(
            @RequestBody SendRequest req,
            @AuthenticationPrincipal UserDetails user) {

        String message = buildMessage(req.getMessage(), user.getUsername(), req.getSenderName());
        int sent;

        if ("ALL".equals(req.getTarget())) {
            if (Boolean.TRUE.equals(req.isUseRoom())) {
                notificationService.sendToRoom(message);
                sent = 1;
            } else {
                sent = notificationService.sendToAll(message);
            }
        } else {
            sent = notificationService.sendToUsernames(req.getUsernames(), message);
        }

        return ResponseEntity.ok(Map.of("sent", sent, "message", "발송 완료"));
    }

    private String buildMessage(String message, String senderUsername, String senderName) {
        String displayName = (senderName != null && !senderName.isBlank()) ? senderName : senderUsername;
        return "📢 **[업무 포탈 공지]** — *" + displayName + "*\n\n" + message;
    }

    @Getter @Setter
    public static class SendRequest {
        private String target;       // "ALL" | "SELECTED"
        private List<String> usernames;
        private String message;
        private String senderName;
        private boolean useRoom;     // true: 룸 발송, false: 개인 DM
    }
}
