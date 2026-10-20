package com.platform.portal.domain.user.service;

import com.platform.portal.domain.deploy.repository.DeployRequestRepository;
import com.platform.portal.domain.request.repository.ChangeRequestRepository;
import com.platform.portal.domain.system.repository.SystemManagerRepository;
import com.platform.portal.domain.user.dto.UserDto;
import com.platform.portal.domain.user.entity.User;
import com.platform.portal.domain.user.repository.UserRepository;
import com.platform.portal.service.MailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class UserService {

    // 삭제 차단용 이력 조회 (F-FIX-001 R-006)
    private final ChangeRequestRepository changeRequestRepository;
    private final DeployRequestRepository deployRequestRepository;
    private final SystemManagerRepository systemManagerRepository;

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
        // EXTERNAL 사용자는 계정 생성 불가
        if (actor.getRole() == User.Role.EXTERNAL) {
            throw new AccessDeniedException("사용자 생성 권한이 없습니다.");
        }
        // MEMBER는 EXTERNAL만 생성 가능
        if (actor.getRole() == User.Role.MEMBER && req.getRole() != User.Role.EXTERNAL) {
            throw new AccessDeniedException("팀원은 외부 사용자만 추가할 수 있습니다.");
        }
        // ADMIN 역할은 신규 생성 불가 (admin 계정은 DB에서 직접 관리)
        if (req.getRole() == User.Role.ADMIN) {
            throw new AccessDeniedException("관리자 계정은 생성할 수 없습니다.");
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
            catch (Exception e) { log.warn("계정 생성 메일 발송 실패 username={} to={}: {}", req.getUsername(), req.getEmail(), e.getMessage()); }
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
        user.setRedmineUserId(req.getRedmineUserId());
        return new UserDto.Summary(user, null);
    }

    @Transactional
    public void delete(Long id, String actorUsername) {
        User actor = userRepository.findByUsername(actorUsername).orElseThrow();
        if (actor.getRole() == User.Role.MEMBER) throw new AccessDeniedException("권한이 없습니다.");
        if (actor.getId().equals(id)) throw new IllegalArgumentException("본인 계정은 삭제할 수 없습니다.");
        // 요청·배포·담당자 FK 이력이 있으면 물리 삭제 불가 → 안내 (username 문자열 참조는 이력으로 보지 않음)
        boolean hasHistory = changeRequestRepository.existsByRequesterId(id)
                || deployRequestRepository.existsByRequesterIdOrApproverId(id, id)
                || systemManagerRepository.existsByUserId(id);
        if (hasHistory) {
            throw new IllegalArgumentException("요청·배포·담당자 이력이 있는 사용자는 삭제할 수 없습니다. 비활성화하세요.");
        }
        userRepository.deleteById(id);
    }

    @Transactional
    public UserDto.Summary resetPassword(Long id, String actorUsername) {
        User actor = userRepository.findByUsername(actorUsername).orElseThrow();
        if (actor.getRole() == User.Role.MEMBER || actor.getRole() == User.Role.EXTERNAL) {
            throw new AccessDeniedException("비밀번호 초기화 권한이 없습니다.");
        }
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        String tempPassword = generatePassword();
        user.setPassword(passwordEncoder.encode(tempPassword));
        user.setMustChangePassword(true);
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            try { mailService.sendInitialCredentials(user.getEmail(), user.getUsername(), tempPassword); }
            catch (Exception e) { log.warn("비밀번호 초기화 메일 발송 실패 username={} to={}: {}", user.getUsername(), user.getEmail(), e.getMessage()); }
        }
        return new UserDto.Summary(user, tempPassword);
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
