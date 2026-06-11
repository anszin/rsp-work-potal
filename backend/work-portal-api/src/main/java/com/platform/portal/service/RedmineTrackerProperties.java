package com.platform.portal.service;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@ConfigurationProperties(prefix = "redmine")
public class RedmineTrackerProperties {

    private List<TrackerConfig> trackers = new ArrayList<>();

    @Getter
    @Setter
    public static class TrackerConfig {
        private int id;
        private String name;
        private List<StatusConfig> statuses = new ArrayList<>();
    }

    @Getter
    @Setter
    public static class StatusConfig {
        private int id;
        private String name;
    }
}
