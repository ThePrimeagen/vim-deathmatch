extern crate termion;

use std::{error::Error, str::FromStr, fs::File};
use std::fmt::{self, Debug};
use std::io::{self, BufRead, Read};
use std::convert::From;
use std::num::ParseIntError;
use std::env;
use io::BufReader;

use termion::event::Key;
use termion::input::TermRead;
use termion::raw::IntoRawMode;
use std::io::{Write, stdout, stdin};

#[derive(Debug)]
enum ParsedLineError {
    _BadId,
    _BadLine,
    _BadClassName,
    _BadState,
    MismatchGameId,
    BadNumber,
    BadCLIArgument,
    BadSeparator,
    NotEnoughCharacters,
}

#[derive(Debug)]
struct ParsedLine {
    id: i32,
    parent_id: Option<i32>,  // -1 = not there
    parent: Option<String>, // -1 = not there
    class_name: String,
    function_name: String,
    state: Vec<String>,
    args: Vec<String>,
}

impl fmt::Display for ParsedLine {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}\n\r", self.state.join(" "))?;
        match &self.parent {
            Some(_) => {
                write!(f, "     {} {} {}", self.id, self.class_name, self.state.join(" "))?;
            },
            None => {
                write!(f, "{} {}", self.id, self.class_name)?;
            }
        }

        return write!(f, " {} {}", self.function_name, self.args.join(", "));
    }
}

impl fmt::Display for ParsedLineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ParsedLineError::MismatchGameId => write!(f, "NO ERROR HERE"),
            ParsedLineError::BadCLIArgument => write!(f, "Bad CLI Argument. Please try again you d-bag"),
            ParsedLineError::_BadLine => write!(f, "Bad Line"),
            ParsedLineError::_BadId => write!(f, "Oh no! your id's are big time suck."),
            ParsedLineError::_BadClassName => write!(f, "Your classname was weak"),
            ParsedLineError::_BadState => write!(f, "F U Mccannch (BadState)"),
            ParsedLineError::BadNumber => write!(f, "F U Mccannch (BadState)"),
            ParsedLineError::BadSeparator => write!(f, "Unable to find separator"),
            ParsedLineError::NotEnoughCharacters => write!(f, "Not enough characters in string."),
       }
    }
}

impl From<ParseIntError> for ParsedLineError {
     fn from(_: ParseIntError) -> Self {
        return ParsedLineError::BadNumber;
    }
}

impl Error for ParsedLineError {}

#[derive(Debug)]
struct LoggerConfig {
    id: i32,
}

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = env::args().collect();

    let mut file: Option<&str> = None;
    let mut game_id: Option<i32> = None;
    let mut i = 1;

    while i < args.len() {
        match args[i].as_str() {
            "-f" => {
                file = Some(args[i + 1].as_str());
                i += 1;
            },
            "-i" => {
                game_id = match args[i + 1].as_str().parse::<i32>() {
                    Ok(v) => Some(v),
                    Err(_) => return Err(Box::new(ParsedLineError::BadCLIArgument))
                };
                i += 1;
            }
            _ => {
                return Err(Box::new(ParsedLineError::BadCLIArgument));
            }
        }
        i += 1;
    }

    if file.is_some() {
        let file = File::open(file.unwrap())?;
        let reader = BufReader::new(file);
        interact_with_lines(parse_lines(game_id, reader)?)?;
    } else {
        for line in io::stdin().lock().lines() {
            print!("{}\n", line?);
        }
    }

    return Ok(());
}

fn group_parsed_lines<'a>(plines: &'a Vec<ParsedLine>) -> Vec<Vec<&'a ParsedLine>> {
    let mut lines: Vec<Vec<&'a ParsedLine>> = vec![];
    if plines.len() == 0 {
        return lines;
    }

    let mut prev_line = &plines[0];
    let mut current_group: Vec<&'a ParsedLine> = vec![prev_line];

    for l in &plines[1..] {

        if prev_line.state == l.state || l.parent.is_some() {
            current_group.push(l);
        }
        else {
            lines.push(current_group);
            current_group = vec![l];
        }

        prev_line = l;
    }

    if current_group.len() > 0 {
        lines.push(current_group);
    }

    return lines;
}

fn interact_with_lines(lines: Vec<ParsedLine>) -> Result<(), Box<dyn Error>> {

    let stdin = io::stdin();
    let mut stdout = io::stdout().into_raw_mode()?;
    let grouped_lines = group_parsed_lines(&lines);
    let mut idx: i32 = 0;

    if grouped_lines.len() == 0 {
        print!("Sorry, no data chump\n");
        return Ok(());
    }

    for c in stdin.keys() {
        /*
        write!(stdout,
               "{}{}",
               termion::cursor::Goto(1, 1),
               termion::clear::CurrentLine)
                .unwrap();
        */

        match c.unwrap() {
            Key::Char('q') => break,
            Key::Char('k') => idx = std::cmp::max(0, idx - 1),
            Key::Char('j') => idx = std::cmp::min(grouped_lines.len() as i32 - 1, idx + 1),
            _ => { }
        }

        print!("XXXX idx {}\n", idx);
        let group = &grouped_lines[idx as usize];
        let mut first = true;
        for item in group {
            if first {
                first = false;
                print!("{}\n\r", item.state.join(" "));
            }
            match &item.parent {
                Some(_) => {
                    print!("     {} {} {}", item.id, item.class_name, item.state.join(" "));
                },
                None => {
                    print!("{} {}", item.id, item.class_name);
                }
            }
            print!(" {} {}\n\r", item.function_name, item.args.join(", "));
        }

        stdout.flush()?;
    }

    return Ok(());
}

fn parse_lines<T: std::io::BufRead>(game_id: Option<i32>, item: T) -> Result<Vec<ParsedLine>, Box<dyn Error>> {
    let mut plines: Vec<ParsedLine> = vec![];

    for line in item.lines() {
        let line = line?;

        match parse(game_id, line.as_str()) {
            Ok(v) => {
                print!("Class name insertion (gentle baby) {}\n", v.class_name);
                plines.push(v);
            },
            Err(ParsedLineError::MismatchGameId) => { },
            Err(e) => {
                print!("I have found an erro, and my stomach hurts! {:?}\n", e);
            }
        }
    }

    return Ok(plines);
}


fn parse(game_id: Option<i32>, og_line: &str) -> Result<ParsedLine, ParsedLineError> {

    // <TS> <ID> <Class> <function name> <state args> <arguments to function>
    // Parent:<ID>:Child
    // state args
    // <timestamp> <count>:<length>:<object><length>:<object>... count <whitespace separator>
    let (
        _,
        line
    ) = parse_number::<u64>(og_line)?;
    let line = pop_separator(line, ' ')?;

    let (
        id,
        line
    ) = parse_number::<i32>(line)?;
    let line = pop_separator(line, ' ')?;

    let (
        class,
        line
    ) = parse_class_name(line)?;
    let line = pop_separator(line, ' ')?;

    if game_id.is_some() {
        let gid = game_id.unwrap();
        if match class.parent_id {
            Some(v) => gid != v,
            None => gid != id,
        } {
            return Err(ParsedLineError::MismatchGameId);
        }
    }

    let (
        function_name,
        line,
    ) = take_until_whitespace(line)?;
    let line = pop_separator(line, ' ')?;

    let (
        states,
        line
    ) = parse_state(line)?;
    let line = pop_separator(line, ' ')?;

    let (
        args,
        line,
    ) = parse_state(line)?;

    assert!(
        line.len() == 0,
        format!("I expected line to be 0 but got {}: with contents {}", line.len(), line));

    return Ok(ParsedLine {
        function_name: function_name.to_string(),
        class_name: class.class_name.to_string(),
        id,
        parent: class.parent_class_name,
        parent_id: class.parent_id,
        state: states.iter().map(|x| x.to_string()).collect(),
        args: args.iter().map(|x| x.to_string()).collect(),
    });
}
    //let mut parsed_lines: Vec<ParsedLine> = vec![];
                //parsed_lines.push(v);

// Big question on making this better
#[derive(Debug)]
struct ParsedClassName {
    class_name: String,
    parent_id: Option<i32>,
    parent_class_name: Option<String>,
}

fn parse_state<'a>(line: &'a str) -> Result<(Vec<&'a str>, &str), ParsedLineError> {
    let (
        state_var_count,
        remaining
    ) = parse_number::<i32>(line)?;

    let remaining = pop_separator(remaining, ':')?;
    let mut states: Vec<&str> = Vec::with_capacity(state_var_count as usize);
    let mut line_consumed: usize = line.len() - remaining.len();

    for _ in 0..state_var_count {
        let (
            state_var_length,
            remaining
        ) = parse_number::<usize>(&line[line_consumed..])?;

        let remaining = pop_separator(remaining, ':')?;
        let (
            state,
            remaining,
        ) = take_n_characters(remaining, state_var_length)?;

        states.push(state);
        line_consumed = line.len() - remaining.len();
    }

    return Ok((states, &line[line_consumed..]));
}

fn parse_class_name(line: &str) -> Result<(ParsedClassName, &str), ParsedLineError> {
    let (class_name, rest_of_string) = take_until_whitespace(line)?;

    if !class_name.contains(":") {
        return Ok((ParsedClassName {
            class_name: class_name.to_string(),
            parent_id: None,
            parent_class_name: None,
        }, rest_of_string));
    }

    let (parent_class, class_name) = take_until(class_name, ':')?;

    let rest_of_class_name = pop_separator(class_name, ':')?;
    let (parent_id, rest_of_class_name) = parse_number::<i32>(rest_of_class_name)?;
    let rest_of_class_name = pop_separator(rest_of_class_name, ':')?;
    let (class_name, _) = take_until_whitespace(rest_of_class_name)?;

    return Ok((ParsedClassName {
        class_name: class_name.to_string(),
        parent_id: Some(parent_id),
        parent_class_name: Some(parent_class.to_string()),
    }, rest_of_string));
}

fn take_until_whitespace(string: &str) -> Result<(&str, &str), ParsedLineError> {
    let count = string.chars().take_while(|c| {
        return !c.is_whitespace();
    }).count();

    return Ok((&string[0..count], &string[count..]));
}

fn take_until(string: &str, character: char) -> Result<(&str, &str), ParsedLineError> {
    let count = string.chars().take_while(|c| {
        return c != &character;
    }).count();

    return Ok((&string[0..count], &string[count..]));
}

fn take_n_characters(string: &str, n: usize) -> Result<(&str, &str), ParsedLineError> {
    if string.len() < n {
        return Err(ParsedLineError::NotEnoughCharacters);
    }

    return Ok((&string[..n], &string[n..]));
}

fn pop_separator(string: &str, separator: char) -> Result<&str, ParsedLineError> {
    let count = string.chars().take_while(|c| {
        return c == &separator;
    }).count();

    if count != 1 {
        return Err(ParsedLineError::BadSeparator);
    }

    return Ok(&string[1..]);
}

fn parse_number<T: FromStr<Err = ParseIntError>>(string: &str) -> Result<(T, &str), ParseIntError> {
    let num_count = string.chars().take_while(|c| {
        return c.is_numeric();
    }).count();

    return Ok((string[..num_count].parse::<T>()?, &string[num_count..]));
}

/*
use serde_json::{Result, Value};
use std::iter::FromIterator;
use std::error::Error;
use std::fmt::{self, Debug};
use std::io::{self, BufRead};
B
#[derive(Debug)]
struct ParsedLine<'a> {
    id: u32,
    parent_id: Option<u32>,  // -1 = not there
    parent: Option<&'a str>, // -1 = not there
    class_name: String,
}

#[derive(Debug)]
enum ParsedLineError {
    BadId,
    BadLine,
    BadClassName,
    BadState,
    BadNumber,
}

impl fmt::Display for ParsedLineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ParsedLineError::BadLine => write!(f, "Bad Line"),
            ParsedLineError::BadId => write!(f, "Oh no! your id's are big time suck."),
            ParsedLineError::BadClassName => write!(f, "Your classname was weak"),
            ParsedLineError::BadState => write!(f, "F U Mccannch (BadState)"),
        }
    }
}

impl Error for ParsedLineError {}

fn main() -> Result<(), Box<dyn Error>> {
    let stdin = io::stdin();
    let x = 5;

    for line in stdin.lock().lines() {
        let line = line?;
        let parsed_line = parse(&line)?;

        print!("ParsedLine {:?}", parsed_line);
    }

    return Ok(());
}

enum ParseState {
    Id,
    ClassName,
    State,
    Args,
    Done,
}

fn parse_class_name(class_name: &str) -> Result<(&str, u32, &str), ParsedLineError> {
    let items: Vec<&str> = class_name.split(":").collect();
    if items.len() != 3 {
        return Err(ParsedLineError::BadClassName);
    }

    let id = match items[1].parse::<u32>() {
        Ok(v) => v,
        Err(_) => {
            return Err(ParsedLineError::BadClassName);
        }
    };

    return Ok((items[0], id, items[2]));
}

#[derive(Debug, PartialEq)]
enum ParseStateState {
    Len,
    ItemLen,
    Item,
    Done,
}

impl Default for ParseStateState {
    fn default() -> Self { return ParseStateState::Len; }
}

#[derive(Debug, Default)]
struct ParsedState<'a> {
    state: ParseStateState,
    state_count: i32,
    state_idx: i32,
    parse_length: i32,
    parse_idx: i32,
    out: Vec<&'a str>,
}

impl<'a> ParsedState<'a> {
    fn new() -> Self {
        return ParsedState {
            state_count: -1,
            ..ParsedState::default()
        };
    }

    fn set_state_count(&mut self, amount: i32) {
        self.state_count = amount;
    }

    fn is_done(&self) -> bool {
        return self.state_idx == self.state_count;
    }
}

fn parse_number(num: &str, err: ParsedLineError) -> Result<u32, ParsedLineError> {
    return match num.parse::<u32>() {
        Ok(v) => Ok(v),
        Err(_) => Err(err),
    };
}

fn parse_number_by_character(current_num: &mut Vec<char>, byte: char) -> Result<Option<i32>, Box<dyn Error>> {
    return match byte {
        ':' => {
            let s = String::from_iter(&*current_num);
            Ok(Some(s.parse()?))
        }
        '0'..='9' => {
            current_num.push(byte);
            Ok(None)
        }
        _ => {
            Err(Box::new(ParsedLineError::BadNumber))
        }
    };
}

fn parse_state<'a>(state: &'a mut ParsedState, chunk: &'a str) -> Result<bool, ParsedLineError> {
    let mut agg: Vec<char> = vec![];

    // split :
    for c in chunk.chars() {
        match state.state {
            ParseStateState::Len => {
                let out = match parse_number_by_character(&mut agg, c).
                        map_err(|_| ParsedLineError::BadState)? {
                            Some(v) => v,
                            None => continue,
                        };

                state.state = ParseStateState::ItemLen;
                state.set_state_count(out);
                agg.clear();
            }
            ParseStateState::ItemLen => {
                let out = match parse_number_by_character(&mut agg, c).
                        map_err(|_| ParsedLineError::BadState)? {
                            Some(v) => v,
                            None => continue,
                        };

                state.state = ParseStateState::Item;
                state.parse_length = out;
                state.parse_idx = 0;
                agg.clear();
            }

            ParseStateState::Item => {
                agg.push(c);
                state.parse_idx += 1;

                if state.parse_idx == state.parse_length {
                    let state_arg: Value =
                        serde_json::from_str(&agg.iter().collect()).
                            map_err(|_| ParsedLineError::BadState)?;

                    // My knowledge fo iterators
                }
            }

            ParseStateState::Done => {}
        };
    }

    return Ok(state.is_done());
}

fn parse(_line: &str) -> Result<ParsedLine, ParsedLineError> {
    let mut id: u32 = 0;
    let mut parent: Option<&str> = None;
    let mut parent_id: Option<u32> = None;
    let mut class_name: String = "suck_my_className".to_string();
    let mut state = ParseState::Id;
    let mut args_state_obj = ParsedState::new();
    let mut parsed_state_obj = ParsedState::new();

    for chunk in _line.split_whitespace() {
        match state {
            ParseState::Id => {
                id = parse_number(chunk, ParsedLineError::BadId)?;
            }

            ParseState::ClassName => {
                class_name = chunk.to_string();
                state = ParseState::State;

                if class_name.contains(":") {
                    let vals = parse_class_name(chunk)?;
                    class_name = vals.2.to_string();
                    parent = Some(vals.0);
                    parent_id = Some(vals.1);
                }
            }

            ParseState::State => {
                if parse_state(&mut parsed_state_obj, chunk)? {
                    state = ParseState::Args;
                }
            }

            ParseState::Args => {
                if parse_state(&mut args_state_obj, chunk)? {
                    state = ParseState::Done;
                }
            }

            ParseState::Done => {
                return Err(ParsedLineError::BadLine);
            }
        }
    }

    // return Err(ParsedLineError::BadLine)
    return Ok(ParsedLine {
        id,
        parent,
        parent_id,
        class_name,
    });
}
*/
