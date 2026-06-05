package com.platform.portal.domain.user.service;

import com.platform.portal.domain.user.dto.UserDto;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import com.platform.portal.service.MailService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

    public List<UserDto.Summary> findAll() {
        return userRepository.findAll().stream().map(u -> new UserDto.Summary(u, null)).toList();
    }

    @Transactional
    public UserDto.Summary create(UserDto.CreateRequest req, String actorUsername) {
        User actor = userRepository.findByUsername(actorUsername).orElseThrow();
        // MEMBER는 EXTERNAL만 생성 가능
        if (actor.getRole() == User.Role.MEMBER && req.getRole() != User.Role.EXTERNAL) {
            throw new AccessDeniedException("팀원은 외부 사용자만 추가할 수 있습니다.");
        }
        // ADMIN만 ADMIN 생성 가능
        if (req.getRole() == User.Role.ADMIN && actor.getRole() != User.Role.ADMIN) {
            throw new AccessDeniedException("관리자 계정은 ADMIN만 생성할 수 있습니다.");
        }
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다: " + req.getUsername());
        }

        String tempPassword = generatePassword();
        User user = new User();
        user.setUsername(req.getUsername());
        user.setName(req.getName());
        user.setDept(req.getDept());
        user.setEmail(req.getEmail());
        user.setRole(req.getRole());
        user.setPassword(passwordEncoder.encode(tempPassword));
        user.setMustChangePassword(true);
        userRepository.save(user);

        if (req.getEmail() != null && !req.getEmail().isBlank()) {
            try { mailService.sendInitialCredentials(req.getEmail(), req.getUsername(), tempPassword); }
            catch (Exception ignored) {}
        }

        return new UserDto.Summary(user, tempPassword);
    }

    @Transactional
    public UserDto.Summary update(Long id, UserDto.UpdateRequest req, String actorUsername) {
        User actor = userRepository.findByUsername(actorUsername).orElseThrow();
        if (actor.getRole() == User.Role.MEMBER) throw new AccessDeniedException("권한이 없습니다.");

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        user.setName(req.getName());
        user.setDept(req.getDept());
        user.setEmail(req.getEmail());
        if (req.getRole() != null) {
            if (req.getRole() == User.Role.ADMIN && actor.getRole() != User.Role.ADMIN) {
                throw new AccessDeniedException("관리자 권한 부여는 ADMIN만 가능합니다.");
            }
            user.setRole(req.getRole());
        }
        if (req.isActive() != user.isActive()) user.setActive(req.isActive());
        return new UserDto.Summary(user, null);
    }

    @Transactional
    public void delete(Long id, String actorUsername) {
        User actor = userRepository.findByUsername(actorUsername).orElseThrow();
        if (actor.getRole() == User.Role.MEMBER) throw new AccessDeniedException("권한이 없습니다.");
        if (actor.getId().equals(id)) throw new IllegalArgumentException("본인 계정은 삭제할 수 없습니다.");
        userRepository.deleteById(id);
    }

    @Transactional
    public void changePassword(String username, String currentPassword, String newPassword) {
        User user = userRepository.findByUsername(username).orElseThrow();
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("현재 비밀번호가 올바르지 않습니다.");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
    }

    private String generatePassword() {
        SecureRandom rnd = new SecureRandom();
        StringBuilder sb = new StringBuilder(10);
        for (int i = 0; i < 10; i++) sb.append(CHARS.charAt(rnd.nextInt(CHARS.length())));
        return sb.toString();
    }
}
