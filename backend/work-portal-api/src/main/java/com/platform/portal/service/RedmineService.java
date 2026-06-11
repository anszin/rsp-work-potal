package com.platform.portal.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RedmineService {

    @Value("${redmine.base-url}")
    private String baseUrl;

    @Value("${redmine.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate;

    public RedmineIssuesResponse searchIssues(String projectKey, String query, String statusId, Integer trackerId, int offset) {
        if (projectKey == null || projectKey.isBlank()) return new RedmineIssuesResponse();
        try {
            String safeProject = URLEncoder.encode(projectKey, StandardCharsets.UTF_8);
            StringBuilder url = new StringBuilder(baseUrl)
                    .append("/issues.json")
                    .append("?project_id=").append(safeProject)
                    .append("&limit=100")
                    .append("&offset=").append(offset)
                    .append("&key=").append(apiKey);
            if (query != null && !query.isBlank()) {
                String safeQuery = URLEncoder.encode(query, StandardCharsets.UTF_8).replace("+", "%20");
                url.append("&subject=~").append(safeQuery);
            }
            if (statusId != null && !statusId.isBlank()) {
                url.append("&status_id=").append(statusId);
            }
            if (trackerId != null) {
                url.append("&tracker_id=").append(trackerId);
            }
            java.net.URI uri = java.net.URI.create(url.toString());
            log.info("Redmine URI: {}", uri);
            RedmineIssuesResponse resp = restTemplate.getForObject(uri, RedmineIssuesResponse.class);
            log.info("Redmine total: {}, fetched: {}", resp != null ? resp.getTotalCount() : 0,
                    resp != null && resp.getIssues() != null ? resp.getIssues().size() : 0);
            return resp != null ? resp : new RedmineIssuesResponse();
        } catch (Exception e) {
            log.error("Redmine API error: {}", e.getMessage());
            throw new RuntimeException("레드마인 검색 실패: " + e.getMessage(), e);
        }
    }

    public Integer createVersion(String projectKey, String versionName, String description) {
        if (projectKey == null || projectKey.isBlank() || versionName == null || versionName.isBlank()) {
            log.warn("Redmine version creation skipped: projectKey or versionName is empty");
            return null;
        }
        try {
            String safeProject = URLEncoder.encode(projectKey, StandardCharsets.UTF_8);
            java.net.URI uri = java.net.URI.create(
                    baseUrl + "/projects/" + safeProject + "/versions.json?key=" + apiKey);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> versionBody = new HashMap<>();
            versionBody.put("name", versionName);
            if (description != null && !description.isBlank()) {
                versionBody.put("description", description);
            }
            versionBody.put("status", "open");

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(Map.of("version", versionBody), headers);
            RedmineVersionResponse resp = restTemplate.postForObject(uri, entity, RedmineVersionResponse.class);
            Integer versionId = resp != null && resp.getVersion() != null ? resp.getVersion().getId() : null;
            log.info("Redmine version created: {} (id={}) in project {}", versionName, versionId, projectKey);
            return versionId;
        } catch (Exception e) {
            log.error("Redmine version creation failed: {}", e.getMessage());
            throw new RuntimeException("레드마인 버전 생성 실패: " + e.getMessage(), e);
        }
    }

    public Integer createIssue(String projectKey, String subject, String description, Integer trackerId) {
        try {
            java.net.URI uri = java.net.URI.create(baseUrl + "/issues.json?key=" + apiKey);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> issueBody = new HashMap<>();
            issueBody.put("project_id", projectKey);
            issueBody.put("subject", subject);
            if (description != null && !description.isBlank()) {
                issueBody.put("description", description);
            }
            if (trackerId != null) {
                issueBody.put("tracker_id", trackerId);
            }

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(Map.of("issue", issueBody), headers);
            RedmineIssueCreateResponse resp = restTemplate.postForObject(uri, entity, RedmineIssueCreateResponse.class);
            Integer issueId = resp != null && resp.getIssue() != null ? resp.getIssue().getId() : null;
            log.info("Redmine issue created: #{} '{}' in project {}", issueId, subject, projectKey);
            return issueId;
        } catch (Exception e) {
            log.error("Redmine issue creation failed: {}", e.getMessage());
            throw new RuntimeException("레드마인 일감 생성 실패: " + e.getMessage(), e);
        }
    }

    public void updateIssueFixedVersion(Integer issueId, Integer versionId) {
        try {
            java.net.URI uri = java.net.URI.create(baseUrl + "/issues/" + issueId + ".json?key=" + apiKey);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(
                    Map.of("issue", Map.of("fixed_version_id", versionId)), headers);
            restTemplate.put(uri, entity);
            log.info("Issue #{} fixed_version set to {}", issueId, versionId);
        } catch (Exception e) {
            log.error("Failed to update issue #{} fixed_version: {}", issueId, e.getMessage());
            throw new RuntimeException("레드마인 일감 버전 설정 실패: " + e.getMessage(), e);
        }
    }

    @Getter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RedmineIssueCreateResponse {
        @JsonProperty("issue")
        private RedmineIssueDetail issue;

        @Getter
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class RedmineIssueDetail {
            private Integer id;
            private String subject;
        }
    }

    @Getter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RedmineVersionResponse {
        @JsonProperty("version")
        private RedmineVersionDetail version;

        @Getter
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class RedmineVersionDetail {
            private Integer id;
            private String name;
        }
    }

    @Getter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RedmineIssuesResponse {
        private List<RedmineIssue> issues = Collections.emptyList();
        @JsonProperty("total_count")
        private Integer totalCount = 0;
    }

    @Getter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RedmineIssue {
        private Integer id;
        private String subject;
        @JsonProperty("status")
        private RedmineRef status;
        @JsonProperty("tracker")
        private RedmineRef tracker;
        @JsonProperty("assigned_to")
        private RedmineRef assignedTo;
    }

    @Getter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RedmineRef {
        private Integer id;
        private String name;
    }
}
