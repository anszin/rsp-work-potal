package com.platform.portal.security;

import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * F-FIX-001 R-004 — 비활성 사용자 인증 차단.
 * 현행: 비활성 사용자도 로그인 200, 토큰 사용 200. 목표: 로그인 401, 토큰 403, 활성 사용자는 그대로 200.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class InactiveUserAuthTest {

    private static final String PASSWORD = "pw1234!";

    @Autowired MockMvc mvc;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JwtTokenProvider tokenProvider;

    @Test
    @DisplayName("비활성 사용자는 올바른 비밀번호로도 로그인할 수 없다 (401)")
    void inactiveUserCannotLogin() throws Exception {
        User u = user("inactive1", false);

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(u.getUsername())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비활성 사용자의 기존 토큰은 인증되지 않는다 (403)")
    void inactiveUserTokenIsRejected() throws Exception {
        User u = user("inactive2", false);
        String token = tokenProvider.createToken(u.getUsername(), u.getRole().name());

        mvc.perform(get("/api/systems").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("활성 사용자는 현행대로 로그인·토큰 사용이 된다 (200)")
    void activeUserStillWorks() throws Exception {
        User u = user("active1", true);

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(u.getUsername())))
                .andExpect(status().isOk());

        String token = tokenProvider.createToken(u.getUsername(), u.getRole().name());
        mvc.perform(get("/api/systems").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    private User user(String username, boolean active) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(username + "@test.local");
        u.setPassword(passwordEncoder.encode(PASSWORD));
        u.setRole(User.Role.MEMBER);
        u.setActive(active);
        return userRepository.saveAndFlush(u);
    }

    private String loginJson(String username) {
        return "{\"username\":\"" + username + "\",\"password\":\"" + PASSWORD + "\"}";
    }
}
