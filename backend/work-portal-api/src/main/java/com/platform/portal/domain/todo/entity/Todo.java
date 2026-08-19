package com.platform.portal.domain.todo.entity;

import com.platform.portal.domain.todo.converter.CheckItemListConverter;
import com.platform.portal.domain.todo.converter.TodoLinkListConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "todos")
@Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class Todo {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.TODO;

    @Enumerated(EnumType.STRING)
    private Priority priority = Priority.MEDIUM;

    private LocalDate startDate;
    private LocalDate dueDate;
    private LocalDate completedDate;

    @Enumerated(EnumType.STRING)
    private SourceType sourceType = SourceType.SELF;

    private Long sourceId;

    private Long workUnitId;

    @Column(nullable = false)
    private String assignee;

    @Convert(converter = CheckItemListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<CheckItem> checkItems = new ArrayList<>();

    @Convert(converter = TodoLinkListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<TodoLink> links = new ArrayList<>();

    @Column(length = 500)
    private String imageUrl;

    @CreatedDate @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public enum Status { TODO, IN_PROGRESS, HOLD, REVIEW, DONE }
    public enum Priority { HIGH, MEDIUM, LOW }
    public enum SourceType { SELF, CHANGE_REQUEST, DEPLOY, EXTERNAL }
}
