package com.platform.portal.domain.request;

import com.platform.portal.domain.request.entity.ChangeRequest;
import com.platform.portal.domain.request.repository.ChangeRequestRepository;
import com.platform.portal.domain.request.service.ChangeRequestService;
import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * F-FIX-001 R-002 — 변경요청 채번.
 * 현행(count+1)에서는 중간 번호 삭제 후 003 이 나와 unique 충돌. 목표는 MAX+1 → 004.
 */
@SpringBootTest
@ActiveProfiles("local")
@Transactional
class ChangeRequestNumberingTest {

    @Autowired ChangeRequestService service;
    @Autowired ChangeRequestRepository repository;
    @Autowired OperationSystemRepository systemRepository;
    @Autowired UserRepository userRepository;

    @Test
    @DisplayName("중간 번호를 삭제해도 다음 번호는 그 해 최대값+1 이다")
    void nextNumberIsMaxPlusOneEvenAfterDelete() {
        int year = LocalDate.now().getYear();
        OperationSystem system = systemRepository.findAll().get(0);          // DataInitializer 시드 SYS001
        User requester = userRepository.findByUsername("admin").orElseThrow();  // 시드 admin

        seed(system, requester, String.format("CR-%d-001", year));
        ChangeRequest second = seed(system, requester, String.format("CR-%d-002", year));
        seed(system, requester, String.format("CR-%d-003", year));
        repository.delete(second);
        repository.flush();

        // @Transactional 프록시가 아닌 실제 객체에서 private 메서드 호출
        Object target = AopTestUtils.getTargetObject(service);
        String next = ReflectionTestUtils.invokeMethod(target, "generateRequestNo");

        assertThat(next).isEqualTo(String.format("CR-%d-004", year));
    }

    private ChangeRequest seed(OperationSystem system, User requester, String requestNo) {
        ChangeRequest cr = new ChangeRequest();
        cr.setSystem(system);
        cr.setRequester(requester);
        cr.setRequestNo(requestNo);
        cr.setTitle("채번 테스트 " + requestNo);
        return repository.saveAndFlush(cr);
    }
}
