use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use web_sys::{WebSocket, MessageEvent, ErrorEvent, CloseEvent};
use js_sys::{Promise, JSON};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Import the `console.log` function from the browser
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Define a macro to make console.log easier to use
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

// WebSocket message structures
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WebSocketMessage {
    #[serde(rename = "type")]
    pub message_type: String,
    pub payload: serde_json::Value,
    pub id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct QueryPayload {
    pub sql: String,
    pub params: Option<Vec<serde_json::Value>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct QueryResult {
    pub sql: String,
    pub params: Vec<serde_json::Value>,
    pub rows: Vec<serde_json::Value>,
    #[serde(rename = "rowCount")]
    pub row_count: usize,
    #[serde(rename = "executionTime")]
    pub execution_time: f64,
    pub timestamp: String,
}

// Basic arithmetic functions
#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    console_log!("Adding {} + {} = {}", a, b, a + b);
    a + b
}

#[wasm_bindgen]
pub fn subtract(a: i32, b: i32) -> i32 {
    console_log!("Subtracting {} - {} = {}", a, b, a - b);
    a - b
}

#[wasm_bindgen]
pub fn multiply(a: i32, b: i32) -> i32 {
    console_log!("Multiplying {} * {} = {}", a, b, a * b);
    a * b
}

#[wasm_bindgen]
pub fn divide(a: i32, b: i32) -> Result<i32, String> {
    if b == 0 {
        console_log!("Error: Division by zero attempted");
        Err("Division by zero".to_string())
    } else {
        let result = a / b;
        console_log!("Dividing {} / {} = {}", a, b, result);
        Ok(result)
    }
}

// String processing functions
#[wasm_bindgen]
pub fn reverse_string(input: &str) -> String {
    let reversed: String = input.chars().rev().collect();
    console_log!("Reversing '{}' to '{}'", input, reversed);
    reversed
}

#[wasm_bindgen]
pub fn to_uppercase(input: &str) -> String {
    let upper = input.to_uppercase();
    console_log!("Converting '{}' to uppercase: '{}'", input, upper);
    upper
}

#[wasm_bindgen]
pub fn count_words(input: &str) -> usize {
    let count = input.split_whitespace().count();
    console_log!("Counting words in '{}': {} words", input, count);
    count
}

#[wasm_bindgen]
pub fn process_string(input: &str) -> String {
    let processed = format!("Processed: {} (length: {})", input, input.len());
    console_log!("Processing string: '{}'", processed);
    processed
}

// Memory management demonstration
#[wasm_bindgen]
pub fn create_array(size: usize) -> Vec<i32> {
    console_log!("Creating array of size {}", size);
    let mut arr = Vec::with_capacity(size);
    for i in 0..size {
        arr.push(i as i32);
    }
    console_log!("Array created successfully");
    arr
}

#[wasm_bindgen]
pub fn sum_array(arr: &[i32]) -> i32 {
    let sum: i32 = arr.iter().sum();
    console_log!("Summing array of {} elements: {}", arr.len(), sum);
    sum
}

// Error handling demonstration
#[wasm_bindgen]
pub fn safe_parse_int(input: &str) -> Result<i32, String> {
    match input.parse::<i32>() {
        Ok(num) => {
            console_log!("Successfully parsed '{}' to {}", input, num);
            Ok(num)
        }
        Err(_) => {
            console_log!("Failed to parse '{}' as integer", input);
            Err(format!("Cannot parse '{}' as integer", input))
        }
    }
}

// WebSocket client functionality
#[wasm_bindgen]
pub struct WasmWebSocketClient {
    websocket: Option<WebSocket>,
    url: String,
    message_counter: u32,
    pending_queries: HashMap<String, js_sys::Function>,
}

#[wasm_bindgen]
impl WasmWebSocketClient {
    #[wasm_bindgen(constructor)]
    pub fn new(url: &str) -> WasmWebSocketClient {
        console_log!("Creating WASM WebSocket client for URL: {}", url);
        WasmWebSocketClient {
            websocket: None,
            url: url.to_string(),
            message_counter: 0,
            pending_queries: HashMap::new(),
        }
    }

    #[wasm_bindgen]
    pub fn connect(&mut self) -> Result<(), JsValue> {
        console_log!("Connecting to WebSocket server: {}", self.url);
        
        let ws = WebSocket::new(&self.url)?;
        ws.set_binary_type(web_sys::BinaryType::Arraybuffer);

        // Set up event handlers
        let onopen_callback = Closure::wrap(Box::new(move |_| {
            console_log!("WASM WebSocket connected successfully");
        }) as Box<dyn FnMut(JsValue)>);
        ws.set_onopen(Some(onopen_callback.as_ref().unchecked_ref()));
        onopen_callback.forget();

        let onerror_callback = Closure::wrap(Box::new(move |e: ErrorEvent| {
            console_log!("WASM WebSocket error: {:?}", e);
        }) as Box<dyn FnMut(ErrorEvent)>);
        ws.set_onerror(Some(onerror_callback.as_ref().unchecked_ref()));
        onerror_callback.forget();

        let onclose_callback = Closure::wrap(Box::new(move |e: CloseEvent| {
            console_log!("WASM WebSocket closed: code={}, reason={}", e.code(), e.reason());
        }) as Box<dyn FnMut(CloseEvent)>);
        ws.set_onclose(Some(onclose_callback.as_ref().unchecked_ref()));
        onclose_callback.forget();

        self.websocket = Some(ws);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn disconnect(&mut self) {
        if let Some(ws) = &self.websocket {
            console_log!("Disconnecting WASM WebSocket");
            let _ = ws.close();
            self.websocket = None;
        }
    }

    #[wasm_bindgen]
    pub fn is_connected(&self) -> bool {
        if let Some(ws) = &self.websocket {
            ws.ready_state() == WebSocket::OPEN
        } else {
            false
        }
    }

    #[wasm_bindgen]
    pub fn send_ping(&mut self, message: &str) -> Result<String, JsValue> {
        if !self.is_connected() {
            return Err(JsValue::from_str("WebSocket not connected"));
        }

        self.message_counter += 1;
        let message_id = format!("wasm_ping_{}_{}", self.message_counter, js_sys::Date::now() as u64);

        let ping_message = WebSocketMessage {
            message_type: "ping".to_string(),
            payload: serde_json::Value::String(message.to_string()),
            id: Some(message_id.clone()),
        };

        self.send_message(&ping_message)?;
        console_log!("WASM sent ping message: {}", message);
        Ok(message_id)
    }

    #[wasm_bindgen]
    pub fn send_query(&mut self, sql: &str, params_json: Option<String>) -> Result<String, JsValue> {
        if !self.is_connected() {
            return Err(JsValue::from_str("WebSocket not connected"));
        }

        self.message_counter += 1;
        let message_id = format!("wasm_query_{}_{}", self.message_counter, js_sys::Date::now() as u64);

        // Parse parameters if provided
        let params = if let Some(params_str) = params_json {
            match serde_json::from_str::<Vec<serde_json::Value>>(&params_str) {
                Ok(p) => Some(p),
                Err(e) => {
                    console_log!("Failed to parse query parameters: {}", e);
                    return Err(JsValue::from_str(&format!("Invalid parameters JSON: {}", e)));
                }
            }
        } else {
            None
        };

        let query_payload = QueryPayload {
            sql: sql.to_string(),
            params,
        };

        let query_message = WebSocketMessage {
            message_type: "query".to_string(),
            payload: serde_json::to_value(query_payload).map_err(|e| {
                JsValue::from_str(&format!("Failed to serialize query: {}", e))
            })?,
            id: Some(message_id.clone()),
        };

        self.send_message(&query_message)?;
        console_log!("WASM sent query: {}", sql);
        Ok(message_id)
    }

    fn send_message(&self, message: &WebSocketMessage) -> Result<(), JsValue> {
        if let Some(ws) = &self.websocket {
            let message_json = serde_json::to_string(message).map_err(|e| {
                JsValue::from_str(&format!("Failed to serialize message: {}", e))
            })?;
            
            ws.send_with_str(&message_json)?;
            console_log!("WASM sent WebSocket message: {}", message_json);
            Ok(())
        } else {
            Err(JsValue::from_str("WebSocket not initialized"))
        }
    }

    #[wasm_bindgen]
    pub fn set_message_handler(&mut self, handler: js_sys::Function) -> Result<(), JsValue> {
        if let Some(ws) = &self.websocket {
            let handler_clone = handler.clone();
            let onmessage_callback = Closure::wrap(Box::new(move |e: MessageEvent| {
                if let Ok(message_data) = e.data().dyn_into::<js_sys::JsString>() {
                    let message_str = String::from(message_data);
                    console_log!("WASM received WebSocket message: {}", message_str);
                    
                    // Call the JavaScript handler with the message
                    let _ = handler_clone.call1(&JsValue::NULL, &JsValue::from_str(&message_str));
                }
            }) as Box<dyn FnMut(MessageEvent)>);
            
            ws.set_onmessage(Some(onmessage_callback.as_ref().unchecked_ref()));
            onmessage_callback.forget();
            Ok(())
        } else {
            Err(JsValue::from_str("WebSocket not initialized"))
        }
    }
}

// Convenience functions for database operations through WebSocket
#[wasm_bindgen]
pub fn wasm_query_database(
    websocket_url: &str,
    sql: &str,
    params_json: Option<String>,
) -> Result<WasmWebSocketClient, JsValue> {
    console_log!("WASM creating database query client");
    
    let mut client = WasmWebSocketClient::new(websocket_url);
    client.connect()?;
    
    console_log!("WASM WebSocket client created and connected");
    Ok(client)
}

#[wasm_bindgen]
pub fn create_websocket_client(url: &str) -> WasmWebSocketClient {
    console_log!("Creating WASM WebSocket client instance");
    WasmWebSocketClient::new(url)
}

// Utility function for initialization
#[wasm_bindgen(start)]
pub fn main() {
    console_log!("WASM module with WebSocket support initialized successfully!");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
        assert_eq!(add(-1, 1), 0);
    }

    #[test]
    fn test_subtract() {
        assert_eq!(subtract(5, 3), 2);
        assert_eq!(subtract(0, 5), -5);
    }

    #[test]
    fn test_multiply() {
        assert_eq!(multiply(3, 4), 12);
        assert_eq!(multiply(-2, 3), -6);
    }

    #[test]
    fn test_divide() {
        assert_eq!(divide(10, 2), Ok(5));
        assert_eq!(divide(7, 3), Ok(2));
        assert!(divide(5, 0).is_err());
    }

    #[test]
    fn test_reverse_string() {
        assert_eq!(reverse_string("hello"), "olleh");
        assert_eq!(reverse_string(""), "");
    }

    #[test]
    fn test_to_uppercase() {
        assert_eq!(to_uppercase("hello"), "HELLO");
        assert_eq!(to_uppercase("World"), "WORLD");
    }

    #[test]
    fn test_count_words() {
        assert_eq!(count_words("hello world"), 2);
        assert_eq!(count_words(""), 0);
        assert_eq!(count_words("single"), 1);
    }

    #[test]
    fn test_sum_array() {
        assert_eq!(sum_array(&[1, 2, 3, 4]), 10);
        assert_eq!(sum_array(&[]), 0);
    }

    #[test]
    fn test_safe_parse_int() {
        assert_eq!(safe_parse_int("123"), Ok(123));
        assert_eq!(safe_parse_int("-456"), Ok(-456));
        assert!(safe_parse_int("abc").is_err());
        assert!(safe_parse_int("12.34").is_err());
    }
}
