package com.platform.portal.domain.system.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "system_servers")
@Getter @Setter @NoArgsConstructor
public class SystemServer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sub_system_id", nullable = false)
    private SubSystem subSystem;

    @Column(nullable = false)
    private String serverName;

    private int stepOrder = 0;

    public SystemServer(SubSystem subSystem, String serverName, int stepOrder) {
        this.subSystem = subSystem;
        this.serverName = serverName;
        this.stepOrder = stepOrder;
    }
}
