package com.platform.portal.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Collections;
import java.util.List;

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
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl + "/issues.json")
                .queryParam("project_id", projectKey)
                .queryParam("subject", "~" + (query == null ? "" : query))
                .queryParam("status_id", "open")
                .queryParam("limit", 20)
                .queryParam("key", apiKey)
                .toUriString();
        try {
            RedmineIssuesResponse resp = restTemplate.getForObject(url, RedmineIssuesResponse.class);
            return resp != null && resp.getIssues() != null ? resp.getIssues() : Collections.emptyList();
        } catch (Exception e) {
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
