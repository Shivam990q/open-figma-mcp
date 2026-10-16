use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

#[derive(Debug, Clone)]
struct CircuitInner {
    state: CircuitState,
    failure_count: u32,
    success_count: u32,
    last_state_change: Instant,
    failure_threshold: u32,
    cooldown: Duration,
}

/// Thread-safe Circuit Breaker implementing standard enterprise resilience patterns.
#[derive(Debug, Clone)]
pub struct CircuitBreaker {
    inner: Arc<Mutex<CircuitInner>>,
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, cooldown: Duration) -> Self {
        Self {
            inner: Arc::new(Mutex::new(CircuitInner {
                state: CircuitState::Closed,
                failure_count: 0,
                success_count: 0,
                last_state_change: Instant::now(),
                failure_threshold,
                cooldown,
            })),
        }
    }

    /// Default production settings: 5 failures, 30s cooldown
    pub fn default_production() -> Self {
        Self::new(5, Duration::from_secs(30))
    }

    /// Check if the circuit allows an outbound execution.
    pub fn allow_request(&self) -> bool {
        let mut inner = self.inner.lock().unwrap();
        match inner.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                if Instant::now().duration_since(inner.last_state_change) > inner.cooldown {
                    inner.state = CircuitState::HalfOpen;
                    inner.success_count = 0;
                    inner.failure_count = 0;
                    inner.last_state_change = Instant::now();
                    true
                } else {
                    false
                }
            }
            CircuitState::HalfOpen => true,
        }
    }

    /// Record a successful call.
    pub fn record_success(&self) {
        let mut inner = self.inner.lock().unwrap();
        match inner.state {
            CircuitState::HalfOpen => {
                inner.success_count += 1;
                if inner.success_count >= 2 {
                    inner.state = CircuitState::Closed;
                    inner.failure_count = 0;
                    inner.last_state_change = Instant::now();
                }
            }
            CircuitState::Closed => {
                inner.failure_count = 0;
            }
            CircuitState::Open => {}
        }
    }

    /// Record a failed call.
    pub fn record_failure(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.failure_count += 1;
        if inner.state == CircuitState::HalfOpen || inner.failure_count >= inner.failure_threshold {
            inner.state = CircuitState::Open;
            inner.last_state_change = Instant::now();
        }
    }

    /// Get current state of the circuit
    pub fn state(&self) -> CircuitState {
        let inner = self.inner.lock().unwrap();
        inner.state
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circuit_trips_to_open() {
        let cb = CircuitBreaker::new(3, Duration::from_millis(50));
        assert!(cb.allow_request());
        assert_eq!(cb.state(), CircuitState::Closed);

        cb.record_failure();
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Closed);

        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Open);
        assert!(!cb.allow_request());

        // Wait for cooldown
        std::thread::sleep(Duration::from_millis(60));
        assert!(cb.allow_request());
        assert_eq!(cb.state(), CircuitState::HalfOpen);

        cb.record_success();
        cb.record_success();
        assert_eq!(cb.state(), CircuitState::Closed);
    }
}
