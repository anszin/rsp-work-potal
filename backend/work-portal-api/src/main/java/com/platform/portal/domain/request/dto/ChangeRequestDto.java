package com.platform.portal.domain.request.dto;

import com.platform.portal.domain.request.entity.ChangeRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.Base64;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class ChangeRequestDto {

    @Getter
    @Setter
    public static class CreateRequest {
        @NotNull
        private Long systemId;
        private Long subSystemId;
        @NotBlank
        private String title;
        private String content;
        private String requesterDept;
        private String requesterName;
        private LocalDate targetDate;
        private String attachmentLink;
        private String attachmentFilename;
        private String attachmentContent; // base64

        public byte[] decodeAttachment() {
            if (attachmentContent == null) return null;
            return Base64.getDecoder().decode(attachmentContent);
        }
    }

    @Getter
    @Setter
    public static class UpdateRequest {
        @NotNull
        private Long systemId;
        private Long subSystemId;
        @NotBlank
        private String title;
        private String content;
        private String requesterDept;
        private String requesterName;
        private LocalDate targetDate;
        private String attachmentLink;
        private String attachmentFilename;
        private String attachmentContent; // base64

        public byte[] decodeAttachment() {
            if (attachmentContent == null) return null;
            return Base64.getDecoder().decode(attachmentContent);
        }
    }

    @Getter
    @Setter
    public static class FileUploadRequest {
        @NotBlank
        private String filename;
        @NotBlank
        private String content; // base64

        public byte[] decode() {
            return Base64.getDecoder().decode(content);
        }
    }

    @Getter
    @Setter
    public static class StatusRequest {
        @NotNull
        private ChangeRequest.Status status;
        private String rejectionReason;
        private String comment;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final String requestNo;
        private final Long systemId;
        private final String systemCode;
        private final String systemName;
        private final Long subSystemId;
        private final String subSystemName;
        private final String title;
        private final String content;
        private final String requesterUsername;
        private final String requesterDept;
        private final String requesterName;
        private final String rejectionReason;
        private final String actionComment;
        private final ChangeRequest.Status status;
        private final LocalDate targetDate;
        private final String attachmentLink;
        private final String attachmentOriginalName;
        private final boolean hasAttachment;
        private final LocalDateTime requestedAt;
        private final LocalDateTime approvedAt;
        private final LocalDateTime completedAt;
        private final LocalDateTime createdAt;

        public Response(ChangeRequest cr) {
            this.id = cr.getId();
            this.requestNo = cr.getRequestNo();
            this.systemId = cr.getSystem().getId();
            this.systemCode = cr.getSystem().getCode();
            this.systemName = cr.getSystem().getName();
            this.subSystemId = cr.getSubSystem() != null ? cr.getSubSystem().getId() : null;
            this.subSystemName = cr.getSubSystem() != null ? cr.getSubSystem().getName() : null;
            this.title = cr.getTitle();
            this.content = cr.getContent();
            this.requesterUsername = cr.getRequester().getUsername();
            this.requesterDept = cr.getRequesterDept();
            this.requesterName = cr.getRequesterName();
            this.rejectionReason = cr.getRejectionReason();
            this.actionComment = cr.getActionComment();
            this.status = cr.getStatus();
            this.targetDate = cr.getTargetDate();
            this.attachmentLink = cr.getAttachmentLink();
            this.attachmentOriginalName = cr.getAttachmentOriginalName();
            this.hasAttachment = cr.getAttachmentPath() != null;
            this.requestedAt = cr.getRequestedAt();
            this.approvedAt = cr.getApprovedAt();
            this.completedAt = cr.getCompletedAt();
            this.createdAt = cr.getCreatedAt();
        }
    }
}
