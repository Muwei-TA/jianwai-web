// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {cleanPaste} from '../src/editor/safety';
it('sanitizes pasted HTML without scripts, styles, embeds or external image requests',()=>{
 const result=cleanPaste('<p style="color:red" onclick="evil()">文字 <strong>加粗</strong><img src="https://evil.test/secret"><iframe src="https://evil.test"></iframe><script>evil()</script><a href="javascript:evil()">坏链接</a><a href="https://example.com" onmouseover="evil()">出处</a></p>');
 expect(result).toContain('<strong>加粗</strong>');expect(result).toContain('坏链接');expect(result).toContain('href="https://example.com/"');
 for(const unsafe of ['script','iframe','style=','onclick','onmouseover','javascript:','evil.test','<img'])expect(result).not.toContain(unsafe);
});
