package com.platform.portal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import com.platform.portal.service.RedmineTrackerProperties;

@SpringBootApplication
@EnableJpaAuditing
@EnableConfigurationProperties(RedmineTrackerProperties.class)
public class WorkPortalApplication {
    public static void main(String[] args) {
        SpringApplication.run(WorkPortalApplication.class, args);
    }
}
