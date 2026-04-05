import { useState, useEffect, useCallback, useRef } from 'react';

// Custom hook for debounced values
export const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

// Custom hook for debounced search
export const useSearch = (initialValue = '', delay = 300) => {
    const [searchTerm, setSearchTerm] = useState(initialValue);
    const debouncedSearchTerm = useDebounce(searchTerm, delay);

    const handleSearchChange = useCallback((e) => {
        setSearchTerm(e.target.value);
    }, []);

    return {
        searchTerm,
        debouncedSearchTerm,
        handleSearchChange,
        setSearchTerm
    };
};

// Custom hook for API calls with caching
export const useApiCache = () => {
    const cache = useRef(new Map());
    const pendingRequests = useRef(new Map());

    const cachedApiCall = useCallback(async (url, options = {}) => {
        const cacheKey = `${url}-${JSON.stringify(options)}`;
        const cachedData = cache.current.get(cacheKey);

        // Return cached data if available and not expired
        if (cachedData && Date.now() - cachedData.timestamp < 5 * 60 * 1000) { // 5 minutes cache
            return cachedData.data;
        }

        // Return pending request if already in progress
        if (pendingRequests.current.has(cacheKey)) {
            return pendingRequests.current.get(cacheKey);
        }

        // Make new request
        const requestPromise = fetch(url, options)
            .then(response => response.json())
            .then(data => {
                // Cache the result
                cache.current.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
                // Remove from pending requests
                pendingRequests.current.delete(cacheKey);
                return data;
            })
            .catch(error => {
                // Remove from pending requests on error
                pendingRequests.current.delete(cacheKey);
                throw error;
            });

        // Store pending request
        pendingRequests.current.set(cacheKey, requestPromise);
        return requestPromise;
    }, []);

    const clearCache = useCallback(() => {
        cache.current.clear();
        pendingRequests.current.clear();
    }, []);

    return { cachedApiCall, clearCache };
};

// Custom hook for performance monitoring
export const usePerformanceMonitor = (componentName) => {
    const renderStart = useRef(performance.now());

    useEffect(() => {
        const renderTime = performance.now() - renderStart.current;
        if (process.env.NODE_ENV === 'development' && renderTime > 16) {
            console.warn(`Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
        }
    });

    const measureFunction = useCallback((fn, functionName) => {
        return (...args) => {
            const start = performance.now();
            const result = fn(...args);
            const end = performance.now();

            if (process.env.NODE_ENV === 'development' && end - start > 5) {
                console.warn(`Slow function ${functionName} in ${componentName}: ${(end - start).toFixed(2)}ms`);
            }

            return result;
        };
    }, [componentName]);

    return { measureFunction };
};

// Custom hook for intersection observer (lazy loading)
export const useIntersectionObserver = (options = {}) => {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsIntersecting(entry.isIntersecting);
            },
            {
                threshold: 0.1,
                ...options
            }
        );

        observer.observe(element);

        return () => {
            observer.unobserve(element);
        };
    }, [options]);

    return [ref, isIntersecting];
};

// Custom hook for throttling
export const useThrottle = (value, delay) => {
    const [throttledValue, setThrottledValue] = useState(value);
    const lastExecuted = useRef(Date.now());

    useEffect(() => {
        if (Date.now() >= lastExecuted.current + delay) {
            lastExecuted.current = Date.now();
            setThrottledValue(value);
        } else {
            const timerId = setTimeout(() => {
                lastExecuted.current = Date.now();
                setThrottledValue(value);
            }, delay);

            return () => clearTimeout(timerId);
        }
    }, [value, delay]);

    return throttledValue;
};