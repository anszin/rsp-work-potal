package com.platform.portal.api;

import com.platform.portal.domain.system.entity.OperationSystem;
import com.platform.portal.domain.system.repository.OperationSystemRepository;
import com.platform.portal.service.RedmineService;
import com.platform.portal.service.RedmineTrackerProperties;
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
    private final RedmineTrackerProperties trackerProperties;

    @GetMapping("/trackers")
    public ResponseEntity<List<RedmineTrackerProperties.TrackerConfig>> getTrackers() {
        return ResponseEntity.ok(trackerProperties.getTrackers());
    }

    // yml 정의 기준으로 전체 일감 한 번에 조회 (클라이언트 사이드 필터용)
    @GetMapping("/issues/all")
    public ResponseEntity<IssueListResponse> fetchAll(
            @RequestParam Long systemId,
            @RequestParam(required = false, defaultValue = "0") int offset) {
        OperationSystem system = systemRepository.findById(systemId)
                .orElseThrow(() -> new IllegalArgumentException("System not found: " + systemId));
        String projectKey = system.getRedmineProjectKey();
        // status=* 로 전체 조회, tracker 필터 없음
        RedmineService.RedmineIssuesResponse resp = redmineService.searchIssues(projectKey, "", "*", null, offset);
        List<RedmineIssueResponse> issues = resp.getIssues().stream().map(RedmineIssueResponse::new).toList();
        return ResponseEntity.ok(new IssueListResponse(issues, resp.getTotalCount() != null ? resp.getTotalCount() : 0));
    }

    @GetMapping("/issues")
    public ResponseEntity<IssueListResponse> searchIssues(
            @RequestParam Long systemId,
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false, defaultValue = "open") String status,
            @RequestParam(required = false) Integer trackerId,
            @RequestParam(required = false, defaultValue = "0") int offset) {
        OperationSystem system = systemRepository.findById(systemId)
                .orElseThrow(() -> new IllegalArgumentException("System not found: " + systemId));
        String projectKey = system.getRedmineProjectKey();
        RedmineService.RedmineIssuesResponse resp = redmineService.searchIssues(projectKey, q, status, trackerId, offset);
        List<RedmineIssueResponse> issues = resp.getIssues().stream().map(RedmineIssueResponse::new).toList();
        return ResponseEntity.ok(new IssueListResponse(issues, resp.getTotalCount() != null ? resp.getTotalCount() : 0));
    }

    public record IssueListResponse(List<RedmineIssueResponse> issues, int totalCount) {}

    @Getter
    public static class RedmineIssueResponse {
        private final Integer id;
        private final String subject;
        private final Integer statusId;
        private final String statusName;
        private final Integer trackerId;
        private final String trackerName;
        private final String assignedTo;

        public RedmineIssueResponse(RedmineService.RedmineIssue issue) {
            this.id = issue.getId();
            this.subject = issue.getSubject();
            this.statusId   = issue.getStatus()  != null ? issue.getStatus().getId()   : null;
            this.statusName = issue.getStatus()  != null ? issue.getStatus().getName() : null;
            this.trackerId  = issue.getTracker() != null ? issue.getTracker().getId()  : null;
            this.trackerName = issue.getTracker() != null ? issue.getTracker().getName() : null;
            this.assignedTo = issue.getAssignedTo() != null ? issue.getAssignedTo().getName() : null;
        }
    }
}
