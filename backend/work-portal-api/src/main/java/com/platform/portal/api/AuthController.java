package com.platform.portal.api;

import com.platform.portal.domain.user.dto.LoginRequest;
import com.platform.portal.domain.user.dto.LoginResponse;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import com.platform.portal.security.JwtTokenProvider;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authManager;
    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        Authentication auth = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword())
        );
        User user = userRepository.findByUsername(auth.getName()).orElseThrow();
        String token = tokenProvider.createToken(user.getUsername(), user.getRole().name());
        return ResponseEntity.ok(new LoginResponse(token, user.getUsername(), user.getRole().name(), user.isMustChangePassword()));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByUsername(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(Map.of(
                "username", user.getUsername(),
                "name", user.getName() != null ? user.getName() : "",
                "dept", user.getDept() != null ? user.getDept() : "",
                "email", user.getEmail() != null ? user.getEmail() : "",
                "role", user.getRole().name(),
                "mustChangePassword", user.isMustChangePassword()
        ));
    }
}
