package com.platform.portal.service;

import com.platform.portal.domain.deploy.entity.DeployRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Slf4j
@Service
public class WebexService {

    @Value("${webex.bot-token:}")
    private String botToken;

    @Value("${webex.room-id:}")
    private String roomId;

    private final RestTemplate restTemplate = new RestTemplate();

    private static final Map<DeployRequest.DeployType, String> TYPE_LABELS = Map.of(
            DeployRequest.DeployType.RELEASE,  "릴리즈",
            DeployRequest.DeployType.HOTFIX,   "핫픽스",
            DeployRequest.DeployType.ROLLBACK,  "롤백",
            DeployRequest.DeployType.PATCH,    "패치"
    );
    private static final Map<DeployRequest.DeployScope, String> SCOPE_LABELS = Map.of(
            DeployRequest.DeployScope.FULL,    "전점",
            DeployRequest.DeployScope.PARTIAL, "일부점"
    );
    private static final Map<DeployRequest.Status, String> STATUS_LABELS = Map.of(
            DeployRequest.Status.REQUESTED, "요청",
            DeployRequest.Status.APPROVED,  "승인",
            DeployRequest.Status.REJECTED,  "반려",
            DeployRequest.Status.COMPLETED, "배포 완료"
    );
    private static final Map<DeployRequest.Status, String> STATUS_EMOJI = Map.of(
            DeployRequest.Status.REQUESTED, "📤",
            DeployRequest.Status.APPROVED,  "✅",
            DeployRequest.Status.REJECTED,  "❌",
            DeployRequest.Status.COMPLETED, "🚀"
    );

    public void notifyCreated(DeployRequest dr) {
        String targetRoomId = resolveRoomId(dr);
        if (targetRoomId == null) return;
        try {
            String sys = dr.getSystem().getName()
                    + (dr.getSubSystem() != null ? " / " + dr.getSubSystem().getName() : "");
            StringBuilder sb = new StringBuilder();
            sb.append("🆕 **배포 등록** `").append(dr.getDeployNo()).append("`\n");
            sb.append("> **[").append(sys).append("]** ").append(dr.getTitle()).append("\n");
            sb.append("> 요청자: **").append(dr.getRequester().getUsername()).append("**");
            if (dr.getVersion() != null && !dr.getVersion().isBlank())
                sb.append(" | 버전: ").append(dr.getVersion());
            if (dr.getDeployType() != null)
                sb.append(" | ").append(TYPE_LABELS.getOrDefault(dr.getDeployType(), dr.getDeployType().name()));
            if (dr.getDeployScope() != null) {
                sb.append(" | ").append(SCOPE_LABELS.getOrDefault(dr.getDeployScope(), dr.getDeployScope().name()));
                if (dr.getDeployScope() == DeployRequest.DeployScope.PARTIAL && dr.getDeployTarget() != null)
                    sb.append(" (").append(dr.getDeployTarget()).append(")");
            }
            if (dr.getScheduledAt() != null)
                sb.append("\n> 예정: ").append(dr.getScheduledAt().toString().replace("T", " ").substring(0, 16));
            sendMessage(sb.toString(), targetRoomId);
        } catch (Exception e) {
            log.warn("Webex notify failed (created): {}", e.getMessage());
        }
    }

    public void notifyStatusChanged(DeployRequest dr, String actorUsername, String comment) {
        String targetRoomId = resolveRoomId(dr);
        if (targetRoomId == null) return;
        try {
            String emoji = STATUS_EMOJI.getOrDefault(dr.getStatus(), "🔔");
            String label = STATUS_LABELS.getOrDefault(dr.getStatus(), dr.getStatus().name());
            String sys = dr.getSystem().getName()
                    + (dr.getSubSystem() != null ? " / " + dr.getSubSystem().getName() : "");
            StringBuilder sb = new StringBuilder();
            sb.append(emoji).append(" **").append(label).append("** `").append(dr.getDeployNo()).append("`\n");
            sb.append("> **[").append(sys).append("]** ").append(dr.getTitle()).append("\n");
            sb.append("> 처리자: **").append(actorUsername).append("**");
            if (comment != null && !comment.isBlank())
                sb.append("\n> ").append(comment);
            sendMessage(sb.toString(), targetRoomId);
        } catch (Exception e) {
            log.warn("Webex notify failed (status {}): {}", dr.getStatus(), e.getMessage());
        }
    }

    private String resolveRoomId(DeployRequest dr) {
        if (botToken == null || botToken.isBlank()) return null;
        String systemRoomId = dr.getSystem().getWebexRoomId();
        if (systemRoomId != null && !systemRoomId.isBlank()) return systemRoomId;
        if (roomId != null && !roomId.isBlank()) return roomId;
        return null;
    }

    private void sendMessage(String markdown, String targetRoomId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(botToken);
        Map<String, String> body = Map.of("roomId", targetRoomId, "markdown", markdown);
        restTemplate.postForEntity("https://webexapis.com/v1/messages",
                new HttpEntity<>(body, headers), String.class);
    }

    private boolean isConfigured() {
        return botToken != null && !botToken.isBlank()
                && roomId != null && !roomId.isBlank();
    }
}
