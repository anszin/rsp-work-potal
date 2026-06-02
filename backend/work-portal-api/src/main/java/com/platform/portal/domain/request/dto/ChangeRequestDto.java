package com.platform.portal.domain.request.dto;

import com.platform.portal.domain.request.entity.ChangeRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class ChangeRequestDto {

    @Getter
    @Setter
    public static class CreateRequest {
        @NotNull
        private Long systemId;
        @NotBlank
        private String title;
        private String content;
        private LocalDate targetDate;
    }

    @Getter
    @Setter
    public static class UpdateRequest {
        @NotNull
        private Long systemId;
        @NotBlank
        private String title;
        private String content;
        private LocalDate targetDate;
    }

    @Getter
    @Setter
    public static class StatusRequest {
        @NotNull
        private ChangeRequest.Status status;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final Long systemId;
        private final String systemCode;
        private final String systemName;
        private final String title;
        private final String content;
        private final String requesterUsername;
        private final ChangeRequest.Status status;
        private final LocalDate targetDate;
        private final LocalDateTime requestedAt;
        private final LocalDateTime approvedAt;
        private final LocalDateTime completedAt;
        private final LocalDateTime createdAt;

        public Response(ChangeRequest cr) {
            this.id = cr.getId();
            this.systemId = cr.getSystem().getId();
            this.systemCode = cr.getSystem().getCode();
            this.systemName = cr.getSystem().getName();
            this.title = cr.getTitle();
            this.content = cr.getContent();
            this.requesterUsername = cr.getRequester().getUsername();
            this.status = cr.getStatus();
            this.targetDate = cr.getTargetDate();
            this.requestedAt = cr.getRequestedAt();
            this.approvedAt = cr.getApprovedAt();
            this.completedAt = cr.getCompletedAt();
            this.createdAt = cr.getCreatedAt();
        }
    }
}
