package com.platform.portal.security;

import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        // active=false 는 disabled → 로그인 시 DisabledException, 토큰 사용 시 JwtAuthFilter 에서 제외 (F-FIX-001 R-004)
        // mustChangePassword 는 JwtAuthFilter 가 일반 API 차단에 사용 (F-AUTH-001 R-007)
        return new PortalUserDetails(
                user.getUsername(),
                user.getPassword(),
                user.isActive(),
                Boolean.TRUE.equals(user.getMustChangePassword()),
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }
}
