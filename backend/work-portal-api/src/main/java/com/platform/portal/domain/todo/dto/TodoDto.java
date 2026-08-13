package com.platform.portal.domain.todo.dto;

import com.platform.portal.domain.todo.entity.Todo;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class TodoDto {

    @Getter @Setter
    public static class SaveRequest {
        @NotBlank
        private String title;
        private String description;
        private Todo.Status status;
        private Todo.Priority priority;
        private LocalDate dueDate;
        private Todo.SourceType sourceType;
        private Long sourceId;
        private Long keyTaskId;
        private Long workUnitId;
        private String assignee; // 매니저가 타인에게 할당할 때 사용
    }

    @Getter
    public static class Response {
        private final Long id;
        private final String title;
        private final String description;
        private final String status;
        private final String priority;
        private final LocalDate dueDate;
        private final String sourceType;
        private final Long sourceId;
        private final Long keyTaskId;
        private final Long workUnitId;
        private final String assignee;
        private final LocalDateTime createdAt;
        private final LocalDateTime updatedAt;

        public Response(Todo t) {
            this.id = t.getId();
            this.title = t.getTitle();
            this.description = t.getDescription();
            this.status = t.getStatus().name();
            this.priority = t.getPriority() != null ? t.getPriority().name() : null;
            this.dueDate = t.getDueDate();
            this.sourceType = t.getSourceType() != null ? t.getSourceType().name() : null;
            this.sourceId = t.getSourceId();
            this.keyTaskId = t.getKeyTaskId();
            this.workUnitId = t.getWorkUnitId();
            this.assignee = t.getAssignee();
            this.createdAt = t.getCreatedAt();
            this.updatedAt = t.getUpdatedAt();
        }
    }
}
