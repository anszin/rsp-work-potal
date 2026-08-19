package com.platform.portal.domain.todo.dto;

import com.platform.portal.domain.todo.entity.CheckItem;
import com.platform.portal.domain.todo.entity.Todo;
import com.platform.portal.domain.todo.entity.TodoLink;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

public class TodoDto {

    @Getter @Setter
    public static class SaveRequest {
        @NotBlank
        private String title;
        private String description;
        private Todo.Status status;
        private Todo.Priority priority;
        private LocalDate startDate;
        private LocalDate dueDate;
        private LocalDate completedDate;
        private Todo.SourceType sourceType;
        private Long sourceId;
        private Long workUnitId;
        private String assignee;
        private List<CheckItem> checkItems;
        private List<TodoLink> links;
        private String imageUrl;
    }

    @Getter
    public static class Response {
        private final Long id;
        private final String title;
        private final String description;
        private final String status;
        private final String priority;
        private final LocalDate startDate;
        private final LocalDate dueDate;
        private final LocalDate completedDate;
        private final String sourceType;
        private final Long sourceId;
        private final Long workUnitId;
        private final String assignee;
        private final LocalDateTime createdAt;
        private final LocalDateTime updatedAt;
        private final List<CheckItem> checkItems;
        private final List<TodoLink> links;
        private final String imageUrl;

        public Response(Todo t) {
            this.id = t.getId();
            this.title = t.getTitle();
            this.description = t.getDescription();
            this.status = t.getStatus().name();
            this.priority = t.getPriority() != null ? t.getPriority().name() : null;
            this.startDate = t.getStartDate();
            this.dueDate = t.getDueDate();
            this.completedDate = t.getCompletedDate();
            this.sourceType = t.getSourceType() != null ? t.getSourceType().name() : null;
            this.sourceId = t.getSourceId();
            this.workUnitId = t.getWorkUnitId();
            this.assignee = t.getAssignee();
            this.createdAt = t.getCreatedAt();
            this.updatedAt = t.getUpdatedAt();
            this.checkItems = t.getCheckItems() != null ? t.getCheckItems() : Collections.emptyList();
            this.links = t.getLinks() != null ? t.getLinks() : Collections.emptyList();
            this.imageUrl = t.getImageUrl();
        }
    }
}
