package com.platform.portal.domain.system.dto;

import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.entity.SubSystem;
import com.platform.portal.domain.system.entity.SystemManager;
import com.platform.portal.domain.system.entity.SystemServer;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

public class SystemDto {

    @Getter
    @Setter
    public static class CreateRequest {
        @NotBlank
        private String code;
        @NotBlank
        private String name;
        private String description;
        private String redmineProjectKey;
        private String webexRoomId;
        private Integer sortOrder;
    }

    @Getter
    @Setter
    public static class UpdateRequest {
        @NotBlank
        private String name;
        private String description;
        private Boolean active;
        private String redmineProjectKey;
        private String webexRoomId;
        private Integer sortOrder;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final String code;
        private final String name;
        private final String description;
        private final String redmineProjectKey;
        private final String webexRoomId;
        private final int sortOrder;

        private final boolean active;
        private final LocalDateTime createdAt;

        public Response(OperationSystem s) {
            this.id = s.getId();
            this.code = s.getCode();
            this.name = s.getName();
            this.description = s.getDescription();
            this.redmineProjectKey = s.getRedmineProjectKey();
            this.webexRoomId = s.getWebexRoomId();
            this.sortOrder = s.getSortOrder() != null ? s.getSortOrder() : 0;
            this.active = s.isActive();
            this.createdAt = s.getCreatedAt();
        }
    }

    @Getter
    @Setter
    public static class SubSystemCreateRequest {
        @NotBlank
        private String code;
        @NotBlank
        private String name;
        private String description;
    }

    @Getter
    @Setter
    public static class SubSystemUpdateRequest {
        @NotBlank
        private String name;
        private String description;
        private Boolean active;
    }

    @Getter
    public static class SubSystemResponse {
        private final Long id;
        private final Long systemId;
        private final String code;
        private final String name;
        private final String description;
        private final boolean active;
        private final LocalDateTime createdAt;

        public SubSystemResponse(SubSystem s) {
            this.id = s.getId();
            this.systemId = s.getSystem().getId();
            this.code = s.getCode();
            this.name = s.getName();
            this.description = s.getDescription();
            this.active = s.isActive();
            this.createdAt = s.getCreatedAt();
        }
    }

    @Getter
    @Setter
    public static class ServerRequest {
        @NotBlank
        private String serverName;
        private int stepOrder;
    }

    @Getter
    public static class ServerResponse {
        private final Long id;
        private final String serverName;
        private final int stepOrder;

        public ServerResponse(SystemServer s) {
            this.id = s.getId();
            this.serverName = s.getServerName();
            this.stepOrder = s.getStepOrder();
        }
    }

    @Getter
    @Setter
    public static class AddManagerRequest {
        @NotNull
        private Long userId;
    }

    @Getter
    public static class ManagerResponse {
        private final Long id;
        private final Long userId;
        private final String username;
        private final String name;
        private final Integer redmineUserId;
        private final LocalDateTime assignedAt;

        public ManagerResponse(SystemManager sm) {
            this.id = sm.getId();
            this.userId = sm.getUser().getId();
            this.username = sm.getUser().getUsername();
            this.name = sm.getUser().getName();
            this.redmineUserId = sm.getUser().getRedmineUserId();
            this.assignedAt = sm.getAssignedAt();
        }
    }
}
