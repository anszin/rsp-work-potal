package com.platform.portal.domain.deploy.dto;

import com.platform.portal.domain.deploy.entity.DeployRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

public class DeployRequestDto {

    @Getter
    @Setter
    public static class CreateRequest {
        @NotNull
        private Long systemId;
        private Long subSystemId;
        @NotBlank
        private String title;
        private String version;
        private DeployRequest.DeployType deployType;
        private String content;
        private LocalDateTime scheduledAt;
    }

    @Getter
    @Setter
    public static class UpdateRequest {
        @NotNull
        private Long systemId;
        private Long subSystemId;
        @NotBlank
        private String title;
        private String version;
        private DeployRequest.DeployType deployType;
        private String content;
        private LocalDateTime scheduledAt;
    }

    @Getter
    @Setter
    public static class StatusRequest {
        @NotNull
        private DeployRequest.Status status;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final Long systemId;
        private final String systemCode;
        private final String systemName;
        private final Long subSystemId;
        private final String subSystemName;
        private final String title;
        private final String version;
        private final DeployRequest.DeployType deployType;
        private final String content;
        private final String requesterUsername;
        private final String approverUsername;
        private final DeployRequest.Status status;
        private final LocalDateTime scheduledAt;
        private final LocalDateTime deployedAt;
        private final LocalDateTime createdAt;

        public Response(DeployRequest dr) {
            this.id = dr.getId();
            this.systemId = dr.getSystem().getId();
            this.systemCode = dr.getSystem().getCode();
            this.systemName = dr.getSystem().getName();
            this.subSystemId = dr.getSubSystem() != null ? dr.getSubSystem().getId() : null;
            this.subSystemName = dr.getSubSystem() != null ? dr.getSubSystem().getName() : null;
            this.title = dr.getTitle();
            this.version = dr.getVersion();
            this.deployType = dr.getDeployType();
            this.content = dr.getContent();
            this.requesterUsername = dr.getRequester().getUsername();
            this.approverUsername = dr.getApprover() != null ? dr.getApprover().getUsername() : null;
            this.status = dr.getStatus();
            this.scheduledAt = dr.getScheduledAt();
            this.deployedAt = dr.getDeployedAt();
            this.createdAt = dr.getCreatedAt();
        }
    }
}
