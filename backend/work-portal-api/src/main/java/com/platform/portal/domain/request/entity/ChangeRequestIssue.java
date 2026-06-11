package com.platform.portal.domain.request.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "change_request_issues")
@Getter
@Setter
@NoArgsConstructor
public class ChangeRequestIssue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "change_request_id", nullable = false)
    private ChangeRequest changeRequest;

    @Column(nullable = false)
    private Integer redmineIssueId;

    private String redmineIssueTitle;

    public ChangeRequestIssue(ChangeRequest changeRequest, Integer redmineIssueId, String redmineIssueTitle) {
        this.changeRequest = changeRequest;
        this.redmineIssueId = redmineIssueId;
        this.redmineIssueTitle = redmineIssueTitle;
    }
}
