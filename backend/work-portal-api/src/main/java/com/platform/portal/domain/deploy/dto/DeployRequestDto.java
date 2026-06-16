package com.platform.portal.domain.deploy.dto;

import com.platform.portal.domain.deploy.entity.DeployRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class DeployRequestDto {

    @Getter
    @Setter
    @NoArgsConstructor
    public static class IssueRef {
        private Integer redmineIssueId;
        private String redmineIssueTitle;

        public IssueRef(Integer redmineIssueId, String redmineIssueTitle) {
            this.redmineIssueId = redmineIssueId;
            this.redmineIssueTitle = redmineIssueTitle;
        }
    }

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
        private DeployRequest.DeployScope deployScope;
        private String deployTarget;
        private String content;
        private LocalDateTime scheduledAt;
        private Long parentDrId;
        private List<IssueRef> redmineIssues = new ArrayList<>();
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
        private DeployRequest.DeployScope deployScope;
        private String deployTarget;
        private String content;
        private LocalDateTime scheduledAt;
        private List<IssueRef> redmineIssues = new ArrayList<>();
    }

    @Getter
    @Setter
    public static class StatusRequest {
        @NotNull
        private DeployRequest.Status status;
        private String comment;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final String deployNo;
        private final Long systemId;
        private final String systemCode;
        private final String systemName;
        private final Long subSystemId;
        private final String subSystemName;
        private final List<IssueRef> redmineIssues;
        private final String title;
        private final String version;
        private final DeployRequest.DeployType deployType;
        private final DeployRequest.DeployScope deployScope;
        private final String deployTarget;
        private final String content;
        private final String requesterUsername;
        private final String approverUsername;
        private final DeployRequest.Status status;
        private final String rejectionReason;
        private final String actionComment;
        private final LocalDateTime scheduledAt;
        private final LocalDateTime requestedAt;
        private final LocalDateTime approvedAt;
        private final LocalDateTime deployedAt;
        private final DeployRequest.RedmineSyncStatus redmineSyncStatus;
        private final Long parentDrId;
        private final LocalDateTime createdAt;

        public Response(DeployRequest dr) {
            this.id = dr.getId();
            this.deployNo = dr.getDeployNo();
            this.systemId = dr.getSystem().getId();
            this.systemCode = dr.getSystem().getCode();
            this.systemName = dr.getSystem().getName();
            this.subSystemId = dr.getSubSystem() != null ? dr.getSubSystem().getId() : null;
            this.subSystemName = dr.getSubSystem() != null ? dr.getSubSystem().getName() : null;
            this.redmineIssues = dr.getRedmineIssues().stream()
                    .map(i -> new IssueRef(i.getRedmineIssueId(), i.getRedmineIssueTitle()))
                    .toList();
            this.title = dr.getTitle();
            this.version = dr.getVersion();
            this.deployType = dr.getDeployType();
            this.deployScope = dr.getDeployScope();
            this.deployTarget = dr.getDeployTarget();
            this.content = dr.getContent();
            this.requesterUsername = dr.getRequester().getUsername();
            this.approverUsername = dr.getApprover() != null ? dr.getApprover().getUsername() : null;
            this.status = dr.getStatus();
            this.rejectionReason = dr.getRejectionReason();
            this.actionComment = dr.getActionComment();
            this.scheduledAt = dr.getScheduledAt();
            this.requestedAt = dr.getRequestedAt();
            this.approvedAt = dr.getApprovedAt();
            this.deployedAt = dr.getDeployedAt();
            this.redmineSyncStatus = dr.getRedmineSyncStatus();
            this.parentDrId = dr.getParentDrId();
            this.createdAt = dr.getCreatedAt();
        }
    }
}
