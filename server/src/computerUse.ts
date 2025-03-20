import { Page } from 'playwright';
import OpenAI from 'openai';
import { tools, toolsList } from './tools';

type Click = {
  type: 'click';
  x: number;
  y: number;
  button: 'left' | 'right' | 'wheel' | 'back' | 'forward';
};

type Scroll = {
  type: 'scroll';
  x: number;
  y: number;
  scroll_x: number;
  scroll_y: number;
};

type Keypress = {
  type: 'keypress';
  keys: string[];
};

type Type = {
  type: 'type';
  text: string;
};

type Wait = {
  type: 'wait';
};

type Screenshot = {
  type: 'screenshot';
};

type ResponseComputerAction = Click | Scroll | Keypress | Type | Wait | Screenshot;

type PendingSafetyCheck = {
  id: string;
  code: string;
  message: string;
};

type ResponseComputerToolCall = {
  type: 'computer_call';
  id: string;
  call_id: string;
  action: ResponseComputerAction;
  status: 'in_progress' | 'completed' | 'incomplete';
  pending_safety_checks: PendingSafetyCheck[];
};

type ResponseOutputMessage = {
  type: 'message';
  id: string;
  content: string;
  role: string;
};

type ResponseOutputItem = ResponseOutputMessage | ResponseComputerToolCall;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function handleModelAction(page: Page, action: ResponseComputerAction) {
  try {
    switch (action.type) {
      case 'click': {
        const { x, y, button } = action;
        const mappedButton = button === 'wheel' ? 'middle' : 
                           button === 'back' || button === 'forward' ? 'left' : button;
        console.log(`Action: click at (${x}, ${y}) with button '${button}'`);
        await page.mouse.click(x, y, { button: mappedButton });
        break;
      }

      case 'scroll': {
        const { x, y, scroll_x, scroll_y } = action;
        console.log(`Action: scroll at (${x}, ${y}) with offsets (scrollX=${scroll_x}, scrollY=${scroll_y})`);
        await page.mouse.move(x, y);
        await page.evaluate(`window.scrollBy(${scroll_x}, ${scroll_y})`);
        break;
      }

      case 'keypress': {
        const { keys } = action;
        for (const k of keys) {
          console.log(`Action: keypress '${k}'`);
          if (k.includes('ENTER')) {
            await page.keyboard.press('Enter');
          } else if (k.includes('SPACE')) {
            await page.keyboard.press(' ');
          } else {
            await page.keyboard.press(k);
          }
        }
        break;
      }

      case 'type': {
        const { text } = action;
        console.log(`Action: type text '${text}'`);
        await page.keyboard.type(text);
        break;
      }

      case 'wait': {
        console.log('Action: wait');
        await page.waitForTimeout(2000);
        break;
      }

      case 'screenshot': {
        console.log('Action: screenshot');
        break;
      }

      default:
        console.log('Unrecognized action:', action);
    }
  } catch (e) {
    console.error('Error handling action', action, ':', e);
  }
}

export async function computerUseLoop(page: Page, userPrompt: string, onUpdate?: (data: any) => void) {
  try {

    // Initial request to start the computer use loop
    let response = await openai.responses.create({
      model: 'computer-use-preview',
      tools: [
        {
          type: 'computer-preview',
          display_width: 1024,
          display_height: 768,
          environment: 'browser',
        },
        ...toolsList,
      ],
      input: [{
        role: 'user',
        content: userPrompt,
      }],
      reasoning: {
        generate_summary: 'concise',
        effort: 'medium',
      },
      truncation: 'auto',
    });

    while (true) {
      const computerCalls = response.output.filter(
        (item): item is ResponseComputerToolCall => 
          item.type === 'computer_call' && 
          'action' in item &&
          'call_id' in item &&
          'pending_safety_checks' in item
      );

      if (computerCalls.length === 0) {
        console.log('No computer call found. Output from model:');
        response.output.forEach((item) => {
          console.log(JSON.stringify(item, null, 2));
        });
        break;
      }

      // We expect at most one computer call per response
      const computerCall = computerCalls[0];
      const lastCallId = computerCall.call_id;
      const action = computerCall.action;
      
      if (!action) {
        throw new Error('No action found in computer call');
      }

      // If there are pending safety checks, acknowledge them
      const safetyChecks = computerCall.pending_safety_checks;
      
      // Execute the action
      await handleModelAction(page, action);
      await page.waitForTimeout(1000); // Allow time for changes to take effect

      // Take a screenshot after the action
      const screenshotBuffer = await page.screenshot();
      const screenshotBase64 = screenshotBuffer.toString('base64');

      // Get the current URL for safety checks
      const currentUrl = page.url();

      // Notify the client about the update if callback provided
      if (onUpdate) {
        onUpdate({
          type: 'screenshot',
          data: `data:image/png;base64,${screenshotBase64}`,
        });
      }

      // Send the screenshot back as a computer_call_output
      response = await openai.responses.create({
        model: 'computer-use-preview',
        previous_response_id: response.id,
        tools: [{
          type: 'computer-preview',
          display_width: 1024,
          display_height: 768,
          environment: 'browser',
        },
        ...toolsList,
      ],
        input: [{
          call_id: lastCallId,
          type: 'computer_call_output',
          acknowledged_safety_checks: safetyChecks,
          output: {
            type: 'computer_screenshot',
            image_url: `data:image/png;base64,${screenshotBase64}`,
          }
        }],
        truncation: 'auto',
      });
    }

    return response;
  } catch (error) {
    console.error('Error in computer use loop:', error);
    throw error;
  }
}
