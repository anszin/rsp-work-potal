package com.platform.portal.domain.user;

import com.platform.portal.domain.request.entity.ChangeRequest;
import com.platform.portal.domain.request.repository.ChangeRequestRepository;
import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import com.platform.portal.domain.user.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * F-FIX-001 R-006 — 이력 있는 사용자 삭제 안내.
 * 현행: deleteById → FK 위반(DataIntegrityViolation) → 500. 목표: IllegalArgumentException + 안내 메시지, 사용자 유지.
 */
@SpringBootTest
@ActiveProfiles("local")
@Transactional
class UserDeleteGuardTest {

    @Autowired UserService userService;
    @Autowired UserRepository userRepository;
    @Autowired ChangeRequestRepository changeRequestRepository;
    @Autowired OperationSystemRepository systemRepository;

    @Test
    @DisplayName("변경요청 이력이 있는 사용자는 삭제되지 않고 안내 메시지를 받는다")
    void userWithHistoryCannotBeDeleted() {
        User u = user("hist1");
        ChangeRequest cr = new ChangeRequest();
        cr.setSystem(systemRepository.findAll().get(0));
        cr.setRequester(u);
        cr.setRequestNo("CR-9999-001");
        cr.setTitle("이력");
        changeRequestRepository.saveAndFlush(cr);

        assertThatThrownBy(() -> {
            userService.delete(u.getId(), "admin");
            userRepository.flush();
        }).isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("삭제할 수 없습니다");
        assertThat(userRepository.existsById(u.getId())).isTrue();
    }

    @Test
    @DisplayName("이력 없는 사용자는 현행대로 삭제된다")
    void userWithoutHistoryIsDeleted() {
        User v = user("nohist1");

        userService.delete(v.getId(), "admin");
        userRepository.flush();

        assertThat(userRepository.existsById(v.getId())).isFalse();
    }

    private User user(String username) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(username + "@test.local");
        u.setPassword("x");
        u.setRole(User.Role.MEMBER);
        return userRepository.saveAndFlush(u);
    }
}
