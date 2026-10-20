package com.platform.portal.domain.system;

import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.entity.SubSystem;
import com.platform.portal.domain.system.entity.SystemServer;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.domain.system.repository.SubSystemRepository;
import com.platform.portal.domain.system.repository.SystemServerRepository;
import com.platform.portal.domain.system.service.OperationSystemService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * F-FIX-001 R-005 — 서버 삭제 소속 검증.
 * 현행: subSystemId 를 무시하고 serverId 만으로 삭제. 목표: 소속 불일치면 IllegalArgumentException, 서버 유지.
 */
@SpringBootTest
@ActiveProfiles("local")
@Transactional
class SystemServerDeleteTest {

    @Autowired OperationSystemService service;
    @Autowired OperationSystemRepository systemRepository;
    @Autowired SubSystemRepository subSystemRepository;
    @Autowired SystemServerRepository serverRepository;

    @Test
    @DisplayName("다른 서브시스템 ID 로는 서버를 삭제할 수 없고, 소속 서브시스템 ID 로는 삭제된다")
    void deleteRequiresMatchingSubSystem() {
        OperationSystem system = systemRepository.findAll().get(0);  // 시드 SYS001
        SubSystem a = subSystem(system, "SUB-A");
        SubSystem b = subSystem(system, "SUB-B");
        SystemServer server = serverRepository.saveAndFlush(new SystemServer(a, "srv-1", 1));

        assertThatThrownBy(() -> service.deleteServer(b.getId(), server.getId()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(serverRepository.existsById(server.getId())).isTrue();

        service.deleteServer(a.getId(), server.getId());
        serverRepository.flush();
        assertThat(serverRepository.existsById(server.getId())).isFalse();
    }

    private SubSystem subSystem(OperationSystem system, String code) {
        SubSystem s = new SubSystem();
        s.setSystem(system);
        s.setCode(code);
        s.setName(code);
        return subSystemRepository.saveAndFlush(s);
    }
}
