package com.platform.portal.support;

import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import com.platform.portal.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * F-AUTH-001 테스트 공통 — 사용자 시드와 Bearer 토큰.
 * @SpringBootTest + local(H2) + @Transactional 테스트 클래스가 상속한다.
 */
public abstract class AuthTestSupport {

    public static final String PASSWORD = "pw1234!";

    @Autowired protected UserRepository userRepository;
    @Autowired protected PasswordEncoder passwordEncoder;
    @Autowired protected JwtTokenProvider tokenProvider;

    protected User user(String username, User.Role role) {
        return user(username, role, username + " 이름", false);
    }

    protected User user(String username, User.Role role, String name, boolean mustChangePassword) {
        User u = new User();
        u.setUsername(username);
        u.setName(name);
        u.setEmail(username + "@test.local");
        u.setPassword(passwordEncoder.encode(PASSWORD));
        u.setRole(role);
        u.setMustChangePassword(mustChangePassword);
        return userRepository.saveAndFlush(u);
    }

    protected String bearer(User u) {
        return "Bearer " + tokenProvider.createToken(u.getUsername(), u.getRole().name());
    }

    protected String bearer(String username) {
        User u = userRepository.findByUsername(username).orElseThrow();
        return bearer(u);
    }
}
