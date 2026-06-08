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

    public List<RedmineIssue> searchIssues(String projectKey, String query) {
        if (projectKey == null || projectKey.isBlank()) return Collections.emptyList();
        try {
            String encodedQuery = URLEncoder.encode(query == null ? "" : query, StandardCharsets.UTF_8);
            // Redmine explicit filter format: f[]=subject&op[subject]=~&v[subject][]=keyword
            String url = baseUrl + "/issues.json"
                    + "?project_id=" + URLEncoder.encode(projectKey, StandardCharsets.UTF_8)
                    + "&f%5B%5D=subject"          // f[]=subject
                    + "&op%5Bsubject%5D=~"        // op[subject]=~  (contains)
                    + "&v%5Bsubject%5D%5B%5D=" + encodedQuery  // v[subject][]=query
                    + "&limit=20"
                    + "&key=" + apiKey;
            log.info("Redmine search URL: {}", url);
            RedmineIssuesResponse resp = restTemplate.getForObject(url, RedmineIssuesResponse.class);
            List<RedmineIssue> issues = resp != null && resp.getIssues() != null ? resp.getIssues() : Collections.emptyList();
            log.info("Redmine search result count: {}", issues.size());
            return issues;
        } catch (Exception e) {
            log.error("Redmine search failed: {}", e.getMessage(), e);
            return Collections.emptyList();
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
