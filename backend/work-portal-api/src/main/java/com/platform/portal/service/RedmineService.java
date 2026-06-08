package com.platform.portal.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RedmineService {

    @Value("${redmine.base-url}")
    private String baseUrl;

    @Value("${redmine.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate;

    public List<RedmineIssue> searchIssues(String projectKey, String query, String statusId) {
        if (projectKey == null || projectKey.isBlank()) return Collections.emptyList();
        try {
            String safeProject = URLEncoder.encode(projectKey, StandardCharsets.UTF_8);
            StringBuilder url = new StringBuilder(baseUrl)
                    .append("/issues.json")
                    .append("?project_id=").append(safeProject)
                    .append("&limit=50")
                    .append("&key=").append(apiKey);
            if (query != null && !query.isBlank()) {
                String safeQuery = URLEncoder.encode(query, StandardCharsets.UTF_8).replace("+", "%20");
                url.append("&subject=~").append(safeQuery);
            }
            if (statusId != null && !statusId.isBlank()) {
                url.append("&status_id=").append(statusId);
            }
            java.net.URI uri = java.net.URI.create(url.toString());
            log.info("Redmine URI: {}", uri);
            RedmineIssuesResponse resp = restTemplate.getForObject(uri, RedmineIssuesResponse.class);
            List<RedmineIssue> issues = resp != null && resp.getIssues() != null ? resp.getIssues() : Collections.emptyList();
            log.info("Redmine result count: {}", issues.size());
            return issues;
        } catch (Exception e) {
            log.error("Redmine API error: {}", e.getMessage());
            throw new RuntimeException("레드마인 검색 실패: " + e.getMessage(), e);
        }
    }

    @Getter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RedmineIssuesResponse {
        private List<RedmineIssue> issues;
    }

    @Getter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RedmineIssue {
        private Integer id;
        private String subject;
        @JsonProperty("status")
        private RedmineRef status;
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
