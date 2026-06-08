package com.platform.portal.api;

import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.service.RedmineService;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/redmine")
@RequiredArgsConstructor
public class RedmineController {

    private final RedmineService redmineService;
    private final OperationSystemRepository systemRepository;

    @GetMapping("/issues")
    public ResponseEntity<List<RedmineIssueResponse>> searchIssues(
            @RequestParam Long systemId,
            @RequestParam(required = false, defaultValue = "") String q) {
        OperationSystem system = systemRepository.findById(systemId)
                .orElseThrow(() -> new IllegalArgumentException("System not found: " + systemId));
        String projectKey = system.getRedmineProjectKey();
        List<RedmineService.RedmineIssue> issues = redmineService.searchIssues(projectKey, q);
        List<RedmineIssueResponse> result = issues.stream().map(RedmineIssueResponse::new).toList();
        return ResponseEntity.ok(result);
    }

    @Getter
    public static class RedmineIssueResponse {
        private final Integer id;
        private final String subject;
        private final String status;
        private final String assignedTo;

        public RedmineIssueResponse(RedmineService.RedmineIssue issue) {
            this.id = issue.getId();
            this.subject = issue.getSubject();
            this.status = issue.getStatus() != null ? issue.getStatus().getName() : null;
            this.assignedTo = issue.getAssignedTo() != null ? issue.getAssignedTo().getName() : null;
        }
    }
}
