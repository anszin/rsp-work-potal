package com.platform.portal.domain.system.dto;

import com.platform.portal.domain.system.entity.OperationSystem;
import jakarta.validation.constraints.NotBlank;
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
    }

    @Getter
    @Setter
    public static class UpdateRequest {
        @NotBlank
        private String name;
        private String description;
        private Boolean active;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final String code;
        private final String name;
        private final String description;
        private final boolean active;
        private final LocalDateTime createdAt;

        public Response(OperationSystem s) {
            this.id = s.getId();
            this.code = s.getCode();
            this.name = s.getName();
            this.description = s.getDescription();
            this.active = s.isActive();
            this.createdAt = s.getCreatedAt();
        }
    }
}
