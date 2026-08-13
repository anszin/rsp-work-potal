package com.platform.portal.domain.workunit.dto;

import com.platform.portal.domain.workunit.entity.WorkUnit;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

public class WorkUnitDto {

    @Getter @Setter
    public static class SaveRequest {
        @NotNull
        private Long keyTaskId;
        @NotBlank
        private String title;
        private WorkUnit.Type type;
        private WorkUnit.Status status;
        private String description;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final Long keyTaskId;
        private final String title;
        private final String type;
        private final String status;
        private final String description;
        private final LocalDateTime createdAt;
        private final LocalDateTime updatedAt;

        public Response(WorkUnit w) {
            this.id = w.getId();
            this.keyTaskId = w.getKeyTaskId();
            this.title = w.getTitle();
            this.type = w.getType().name();
            this.status = w.getStatus().name();
            this.description = w.getDescription();
            this.createdAt = w.getCreatedAt();
            this.updatedAt = w.getUpdatedAt();
        }
    }
}
