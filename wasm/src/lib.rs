use wasm_bindgen::prelude::*;

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

// Utility function for initialization
#[wasm_bindgen(start)]
pub fn main() {
    console_log!("WASM module initialized successfully!");
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
