package fhv.omni.gateway.forwarding;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;

@Component
public class SessionOrCookieFilter extends OncePerRequestFilter {

    private static final String SESSION_COOKIE_NAME = "SESSION";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        boolean hasSessionCookie = false;
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            hasSessionCookie = Arrays.stream(cookies)
                    .anyMatch(cookie -> SESSION_COOKIE_NAME.equals(cookie.getName()));
        }

        if (hasSessionCookie) {
            filterChain.doFilter(request, response);
        } else {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Session cookie required");
        }
    }
}
