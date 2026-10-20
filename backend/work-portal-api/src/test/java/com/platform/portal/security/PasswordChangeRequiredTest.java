package com.platform.portal.security;

import com.platform.portal.domain.user.entity.User;
import com.platform.portal.support.AuthTestSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** F-AUTH-001 R-007 — 비밀번호 변경 강제(백엔드 필터). 현행: mustChangePassword 와 무관하게 전부 200. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class PasswordChangeRequiredTest extends AuthTestSupport {

    @Autowired MockMvc mvc;

    @Test
    @DisplayName("비밀번호 변경이 필요한 사용자는 일반 API 를 쓸 수 없다 (403 + code)")
    void generalApiBlocked() throws Exception {
        User u = user("pc-u1", User.Role.MEMBER, "변경 필요", true);

        mvc.perform(get("/api/systems").header("Authorization", bearer(u)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
    }

    @Test
    @DisplayName("내 정보 조회와 메뉴 권한 조회는 허용된다 (200)")
    void allowedPathsStillWork() throws Exception {
        User u = user("pc-u2", User.Role.MEMBER, "변경 필요", true);

        mvc.perform(get("/api/auth/me").header("Authorization", bearer(u))).andExpect(status().isOk());
        mvc.perform(get("/api/menu-permissions").header("Authorization", bearer(u))).andExpect(status().isOk());
    }

    @Test
    @DisplayName("비밀번호를 바꾸면 일반 API 가 다시 열린다")
    void unlockedAfterChange() throws Exception {
        User u = user("pc-u3", User.Role.MEMBER, "변경 필요", true);
        String body = "{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"newpw1234!\"}";

        mvc.perform(post("/api/users/change-password").header("Authorization", bearer(u))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/systems").header("Authorization", bearer(u)))
                .andExpect(status().isOk());
    }
}
