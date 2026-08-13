package com.platform.portal.domain.todo.repository;

import com.platform.portal.domain.todo.entity.Todo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TodoRepository extends JpaRepository<Todo, Long> {
    List<Todo> findByAssigneeOrderByCreatedAtDesc(String assignee);
    List<Todo> findAllByOrderByCreatedAtDesc();
}
