package com.platform.portal.domain.deploy.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "deploy_steps")
@Getter @Setter @NoArgsConstructor
public class DeployStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deploy_request_id", nullable = false)
    private DeployRequest deployRequest;

    @Column(nullable = false)
    private String serverName;

    private int stepOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StepStatus status = StepStatus.PENDING;

    private String completedBy;
    private LocalDateTime completedAt;

    public enum StepStatus { PENDING, DONE }

    public DeployStep(DeployRequest deployRequest, String serverName, int stepOrder) {
        this.deployRequest = deployRequest;
        this.serverName = serverName;
        this.stepOrder = stepOrder;
    }
}
