package com.platform.portal.security;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

/** 포탈 전용 UserDetails — 비밀번호 변경 강제 플래그를 인증 정보에 싣는다 (F-AUTH-001 R-007). */
@Getter
public class PortalUserDetails extends org.springframework.security.core.userdetails.User {

    private final boolean mustChangePassword;

    public PortalUserDetails(String username, String password, boolean enabled, boolean mustChangePassword,
                             Collection<? extends GrantedAuthority> authorities) {
        super(username, password, enabled, true, true, true, authorities);
        this.mustChangePassword = mustChangePassword;
    }
}
