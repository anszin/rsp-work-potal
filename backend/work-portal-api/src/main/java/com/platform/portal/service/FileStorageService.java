package com.platform.portal.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.*;

@Service
public class FileStorageService {

    @Value("${app.upload.path:/opt/work-portal/uploads}")
    private String uploadPath;

    public String store(MultipartFile file, Long requestId) throws IOException {
        Path dir = Paths.get(uploadPath);
        Files.createDirectories(dir);
        String filename = requestId + "_" + file.getOriginalFilename();
        Files.copy(file.getInputStream(), dir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
        return filename;
    }

    public Resource load(String filename) throws MalformedURLException {
        Path file = Paths.get(uploadPath).resolve(filename);
        Resource resource = new UrlResource(file.toUri());
        if (resource.exists() && resource.isReadable()) return resource;
        throw new RuntimeException("File not found: " + filename);
    }

    public void delete(String filename) throws IOException {
        if (filename == null) return;
        Files.deleteIfExists(Paths.get(uploadPath).resolve(filename));
    }
}
