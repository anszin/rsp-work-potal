package com.platform.portal.domain.deploy.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "deploy_request_issues")
@Getter
@Setter
@NoArgsConstructor
public class DeployRequestIssue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deploy_request_id", nullable = false)
    private DeployRequest deployRequest;

    @Column(nullable = false)
    private Integer redmineIssueId;

    @Column(length = 500)
    private String redmineIssueTitle;

    public DeployRequestIssue(DeployRequest deployRequest, Integer redmineIssueId, String redmineIssueTitle) {
        this.deployRequest = deployRequest;
        this.redmineIssueId = redmineIssueId;
        this.redmineIssueTitle = redmineIssueTitle;
    }
}
