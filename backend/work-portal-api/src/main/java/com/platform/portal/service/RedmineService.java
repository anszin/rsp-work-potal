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

    public RedmineIssuesResponse searchIssues(String projectKey, String query, String statusId, int offset) {
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
