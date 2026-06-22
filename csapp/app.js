const CHAPTERS = [
  {
    id: 1,
    title: "计算机系统漫游",
    slug: "A programmer's view of the whole machine",
    tags: ["编译", "链接", "进程", "并发", "虚拟内存"],
    summary: "一行 C 代码并不会直接抵达处理器。它先被翻译、拼接、装入内存，最后作为一个进程被调度。第一章的任务不是记名词，而是先拿到这张“从文本到执行”的总地图。",
    concepts: [
      ["程序 = 数据 + 指令", "同一份比特，在不同上下文里可以是字符、整数、机器指令或地址。"],
      ["系统是协作链", "编译器、链接器、内核和硬件各自只完成一小段，却共同决定程序的命运。"],
      ["抽象带来效率", "进程、虚拟内存和文件把复杂细节藏起来，也会在边界处露出成本。"],
      ["性能跨层发生", "一次慢，不一定慢在算法；缓存、系统调用和网络都可能是答案。"],
    ],
    trace: [
      ["翻译", "预处理和编译把人读的 C，变成处理器能够执行的机器级表示。"],
      ["拼接", "链接器解析符号、合并目标文件，给函数和全局数据安一个位置。"],
      ["装入", "内核创建进程、建立虚拟地址空间，再把可执行文件映射进来。"],
    ],
    code: '#include <stdio.h>\n\nint main(void) {\n  printf("hello, systems\\n");\n  return 0;\n}',
    caption: "从这 4 行出发，用 gcc -E、-S、-c 和 objdump 依次看它留下的中间痕迹。",
    memory: [
      ["心智模型", "把程序想成一封穿过多站的信：每一站都重写一点格式。"],
      ["常见误区", "“能运行”不意味着你已经知道它由谁加载、在哪个地址执行。"],
      ["动手试试", "比较 hello.c、hello.i、hello.s 和 hello.o 的大小与可读性。"],
    ],
  },
  {
    id: 2,
    title: "信息的表示和处理",
    slug: "Bits are the common currency",
    tags: ["二进制", "补码", "浮点数", "位运算", "溢出"],
    summary: "比特是系统的通用货币，但解释规则从不免费。理解补码、无符号数和 IEEE 浮点表示，才能预测强制转换、溢出与比较到底会发生什么。",
    concepts: [
      ["字节可寻址", "地址通常指向一个字节；多字节对象如何排列，取决于机器的字节序。"],
      ["补码不对称", "n 位补码能表示 -2^(n-1)，却不能表示对应的正数。最小值取反仍是自己。"],
      ["无符号是模运算", "溢出不是异常，而是悄悄绕回 2^w 的同余类。"],
      ["浮点数有间隙", "相邻可表示浮点数之间并不等距；越大，间隙越大。"],
    ],
    trace: [
      ["选解释", "先问这串比特被当成 signed、unsigned 还是 float，再谈数值。"],
      ["看宽度", "截断、扩展和转换的结果都依赖位宽，而不是变量名的直觉。"],
      ["找边界", "最容易出错的是零、最大值、最小值、符号位翻转的那一格。"],
    ],
    code: 'int x = -42;\nunsigned ux = (unsigned)x;\n\nprintf("%d\\n", x);\nprintf("%u\\n", ux);\nprintf("%08x\\n", ux);',
    caption: "数值不同，底层位模式却可相同。把十六进制打印出来，能让“重新解释”变得看得见。",
    memory: [
      ["心智模型", "数值是比特串加上一副解释眼镜；换眼镜，位不动，含义会变。"],
      ["常见误区", "把 unsigned 当成“永远非负”的普通整数，忽略隐式转换。"],
      ["动手试试", "用 uint8_t 重写加法，观察 255 + 1 为什么回到 0。"],
    ],
  },
  {
    id: 3,
    title: "程序的机器级表示",
    slug: "How C becomes a choreography of registers",
    tags: ["x86-64", "寄存器", "栈帧", "调用约定", "汇编"],
    summary: "汇编并不神秘：它只是把控制流、数据流和调用约定说得更直白。读懂寄存器、栈和跳转，就能用机器的视角重新理解函数。",
    concepts: [
      ["寄存器是快草稿纸", "参数、返回值和临时结果优先放在寄存器；数量有限，所以需要约定。"],
      ["栈是调用的时间线", "每次调用留下一个栈帧，保存返回地址、局部状态与需要恢复的寄存器。"],
      ["控制流就是跳转", "if、while、switch 最终都会落成条件码配合 jump 或 cmov。"],
      ["数组是地址计算", "a[i] 的本质是 base + i × sizeof(element)，没有“数组指令”。"],
    ],
    trace: [
      ["传参", "按调用约定把前几个参数送入规定寄存器，多余部分再借助栈。"],
      ["执行", "算术、寻址、比较都围绕寄存器和条件码展开。"],
      ["返回", "返回值放回约定位置，ret 取回保存的地址，控制权回到调用者。"],
    ],
    code: 'long clamp_nonnegative(long x) {\n  if (x < 0)\n    return 0;\n  return x;\n}',
    caption: "用 gcc -Og -S 生成汇编，再对比 -O2：后者常会用条件传送消掉分支。",
    memory: [
      ["心智模型", "函数调用不是“跳进去再回来”，而是一份双方都遵守的寄存器与栈的合同。"],
      ["常见误区", "以为局部变量天然在栈上；优化后，它可能从头到尾都没离开寄存器。"],
      ["动手试试", "给函数加入一个局部数组，观察编译器何时必须调整栈指针。"],
    ],
  },
  {
    id: 4,
    title: "处理器体系结构",
    slug: "The machine underneath the instructions",
    tags: ["ISA", "流水线", "冒险", "分支预测", "Y86"],
    summary: "处理器不是魔法盒子。取指、译码、执行、访存、写回这些阶段串成流水线；而数据依赖和错误预测，正是流水线需要认真处理的现实摩擦。",
    concepts: [
      ["ISA 是边界", "指令集定义软件能依赖的行为，却不规定微架构怎样实现。"],
      ["流水线求吞吐", "把一条指令拆成阶段，让多条指令同时占据不同阶段。"],
      ["冒险必须化解", "前一条结果还没产生，后一条就想使用；需要暂停、转发或插泡。"],
      ["预测是下注", "分支预测让取指提前继续；猜错时，已经走远的工作需要被冲掉。"],
    ],
    trace: [
      ["取指", "从 PC 指向的位置取出指令字节，并预估下一条的位置。"],
      ["计算", "ALU 完成算术或地址计算，条件码记录刚刚发生的比较。"],
      ["提交", "结果真正写入寄存器或内存，才成为后续指令可见的状态。"],
    ],
    code: 'long sum_to(long n) {\n  long sum = 0;\n  while (n > 0) {\n    sum += n;\n    n--;\n  }\n  return sum;\n}',
    caption: "圈出循环中每次迭代依赖上一轮结果的位置：它就是流水线难以完全并行的证据。",
    memory: [
      ["心智模型", "流水线像洗衣流水线：叠衣服的人能开工，不代表洗衣机已经洗完下一桶。"],
      ["常见误区", "把时钟频率和程序速度画等号；停顿、缓存未命中和分支错猜都在偷走周期。"],
      ["动手试试", "改写循环减少分支，编译后比较生成的跳转指令。"],
    ],
  },
  {
    id: 5,
    title: "优化程序性能",
    slug: "Measure first; move the bottleneck second",
    tags: ["性能分析", "循环展开", "依赖链", "局部性", "优化"],
    summary: "性能优化的第一步不是聪明，而是测量。找到真正限制吞吐的关键路径后，才有资格谈循环展开、减少过程调用或改进内存访问。",
    concepts: [
      ["测量胜过猜测", "可靠的基线、重复实验与消除噪声，是所有优化结论的地基。"],
      ["工作与跨度", "总工作量影响吞吐，最长依赖链限制延迟；两个问题不能混为一谈。"],
      ["编译器会帮忙", "死代码删除、强度削减、寄存器分配经常已经在发生；先看生成结果。"],
      ["局部性很值钱", "让数据按被访问的顺序靠近，通常比微调某一条算术指令更有效。"],
    ],
    trace: [
      ["定基线", "固定输入规模和编译选项，记录时间、波动与正确性结果。"],
      ["找瓶颈", "用 profile 或最小实验定位：卡在计算、分支，还是等待数据？"],
      ["单点改动", "每次只改变一个假设，再用同一把尺子验证是否真的更快。"],
    ],
    code: 'double dot(const double *a, const double *b, long n) {\n  double sum = 0;\n  for (long i = 0; i < n; i++)\n    sum += a[i] * b[i];\n  return sum;\n}',
    caption: "这个累加器形成一条依赖链。尝试用多个部分和，看看吞吐如何变化。",
    memory: [
      ["心智模型", "优化像医生问诊：先定位病灶，再开最小剂量的药。"],
      ["常见误区", "只看一次运行时间，或在没有证据时为了“快”牺牲可读性。"],
      ["动手试试", "为 dot 写一个四路展开版本，并确认浮点误差是否改变。"],
    ],
  },
  {
    id: 6,
    title: "存储器层次结构",
    slug: "Fast memory is small; small memory is close",
    tags: ["Cache", "局部性", "TLB", "写策略", "矩阵"],
    summary: "内存并不是一块均匀的平面。寄存器、缓存、主存和磁盘用容量换速度；程序的访问模式决定它能否吃到缓存的红利。",
    concepts: [
      ["局部性是预测", "时间局部性押注“很快还会用”，空间局部性押注“附近也会用”。"],
      ["缓存按块搬运", "缓存不是按变量名工作，而是按连续字节块装入、替换与写回。"],
      ["映射会冲突", "即便总容量够用，两个热点块也可能被迫争同一个缓存位置。"],
      ["带宽不是延迟", "一次传很多数据可以提高吞吐，但不会让第一字节更早抵达。"],
    ],
    trace: [
      ["生成地址", "CPU 先产生一个虚拟地址，再由地址转换逻辑寻找物理位置。"],
      ["查询缓存", "用地址的一部分索引集合，再用 tag 判断需要的块是否已经在场。"],
      ["未命中代价", "缓存向下一层取整块数据；代价会沿层次结构逐层放大。"],
    ],
    code: 'for (long i = 0; i < n; i++)\n  for (long j = 0; j < n; j++)\n    sum += a[i][j];',
    caption: "C 的二维数组按行连续。把 i 和 j 交换后，在相同数据上测一次，就能感到空间局部性。",
    memory: [
      ["心智模型", "缓存像桌面的便利贴：离手近、空间少，放什么决定了下一次伸手是否省事。"],
      ["常见误区", "认为“顺序代码”就一定缓存友好；关键是内存地址的实际步长。"],
      ["动手试试", "写一个不同 stride 的数组扫描，画出每元素耗时随步长的变化。"],
    ],
  },
  {
    id: 7,
    title: "链接",
    slug: "Making separately built pieces agree",
    tags: ["目标文件", "符号", "静态库", "动态链接", "重定位"],
    summary: "链接器把分散编译的模块接成一个程序。它解决的核心问题很朴素：谁定义了这个名字？它最终在哪个地址？可正是这些问题，塑造了库、插件和可执行文件。",
    concepts: [
      ["符号是承诺", "函数与全局变量的名字，是模块之间彼此可见的接口。"],
      ["重定位补地址", "编译阶段不知道最终布局，所以目标文件先保留需要链接器修补的位置。"],
      ["静态链接做复制", "库代码被挑选并放进可执行文件，发布简单，体积和更新成本更高。"],
      ["动态链接做共享", "装载或运行时再绑定共享库，节省内存，也引入版本与搜索路径问题。"],
    ],
    trace: [
      ["收集", "链接器读取多个可重定位目标文件和库，建立符号表。"],
      ["解析", "每个外部引用都要找到唯一、合适的定义；强弱符号会影响选择。"],
      ["重定位", "合并各节并确定地址，把引用处改成最终可用的编码。"],
    ],
    code: '// math.c\nlong twice(long x) { return x * 2; }\n\n// main.c\nlong twice(long);\nint main(void) { return twice(21) != 42; }',
    caption: "分别编译两个文件，再用 nm 查看符号、用 objdump -r 查看尚未解决的重定位。",
    memory: [
      ["心智模型", "链接像排演前的演员表：先确认角色由谁演，再写好每个人登场的位置。"],
      ["常见误区", "把头文件当成实现；它只是在编译期告诉别人“这个名字长什么样”。"],
      ["动手试试", "故意把 twice 的参数类型改错，比较编译器和链接器分别会不会报错。"],
    ],
  },
  {
    id: 8,
    title: "异常控制流",
    slug: "When the normal path is interrupted",
    tags: ["异常", "进程", "信号", "非本地跳转", "fork"],
    summary: "程序并非只沿着函数调用这条路前进。硬件异常、系统调用、进程上下文切换和信号，会让控制流暂时离开“正常路径”，再以严格的规则返回。",
    concepts: [
      ["异常有来源", "中断来自外部设备，陷阱由指令主动触发，故障可恢复，终止通常不可恢复。"],
      ["内核接管", "异常发生时处理器保存必要状态，跳入内核的处理例程。"],
      ["进程是隔离容器", "每个进程有独立地址空间和上下文；调度器负责让它们轮流前进。"],
      ["信号是异步提醒", "它可能在任意指令边界抵达，因此处理函数必须特别克制。"],
    ],
    trace: [
      ["发生", "事件让处理器查异常表，并在受控入口保存当前执行现场。"],
      ["处理", "内核修复、转交系统调用或决定终止；过程中可能调度另一个进程。"],
      ["恢复", "若允许继续，恢复保存的状态，控制流回到被中断处或指定位置。"],
    ],
    code: 'volatile sig_atomic_t seen = 0;\n\nvoid on_alarm(int signum) {\n  (void)signum;\n  seen = 1;\n}',
    caption: "信号处理函数应尽量只做可重入、简单的事。printf 看似方便，却不是一个好选择。",
    memory: [
      ["心智模型", "异常控制流像有人按下暂停键：现场被收好，先处理紧急事件，再决定从哪里继续。"],
      ["常见误区", "以为信号一定在“方便的时候”发生，或在处理函数里调用复杂库函数。"],
      ["动手试试", "写一个父进程 fork 子进程的程序，打印两边的 PID 并观察输出顺序。"],
    ],
  },
  {
    id: 9,
    title: "虚拟内存",
    slug: "One address space, many useful illusions",
    tags: ["地址转换", "页表", "缺页", "mmap", "分配器"],
    summary: "虚拟内存把地址空间变成一份每个进程独享、看似连续的地图。页表完成翻译，缺页把缓慢的存储纳入工作集，而分配器则在用户空间管理碎片与复用。",
    concepts: [
      ["地址是虚拟的", "程序使用虚拟地址，硬件和内核共同把它映射到物理页或磁盘后备。"],
      ["页是管理单位", "固定大小的页让映射、保护、换入换出拥有统一粒度。"],
      ["缺页可以继续", "访问尚未在内存中的合法页会触发缺页异常，内核装入后再重试指令。"],
      ["分配器管空闲块", "malloc 不是系统调用的同义词；它常从已有堆区切分、合并内存块。"],
    ],
    trace: [
      ["拆地址", "虚拟地址被分为 VPN 与页内偏移；偏移在翻译前后保持不变。"],
      ["查映射", "TLB 命中最快；未命中则查页表，必要时触发缺页异常。"],
      ["拼物理地址", "拿到物理页号后与原偏移拼接，才去访问缓存与主存。"],
    ],
    code: 'char *page = mmap(NULL, 4096, PROT_READ | PROT_WRITE,\n                  MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);\npage[0] = \'A\';\nmunmap(page, 4096);',
    caption: "mmap 直接申请一页匿名映射。配合 /proc 或系统工具观察映射前后，地址空间会变具体。",
    memory: [
      ["心智模型", "虚拟地址像城市里的门牌号；门牌稳定，不代表背后房间总在同一块土地上。"],
      ["常见误区", "把虚拟内存只理解成“内存不够时用硬盘”，忽略隔离、保护和映射。"],
      ["动手试试", "逐页写入一大块 calloc 内存，并对比第一次与第二次遍历的耗时。"],
    ],
  },
  {
    id: 10,
    title: "系统级 I/O",
    slug: "Everything is a file descriptor until it isn't",
    tags: ["文件描述符", "read", "write", "缓冲", "RIO"],
    summary: "Unix I/O 用少量系统调用统一处理文件、终端、管道与套接字。文件描述符是那个统一入口；可靠 I/O 则要求你认真对待短读、短写与中断。",
    concepts: [
      ["描述符是句柄", "一个小整数指向内核维护的打开文件表项，0、1、2 只是最常见的约定。"],
      ["字节流无消息边界", "read 返回多少由当前可用数据和请求大小共同决定，不能假设一次读满。"],
      ["缓冲换系统调用", "用户态缓冲减少陷入内核次数，却改变了数据何时真正写出的直觉。"],
      ["错误要分情况", "EOF、暂时不可用、被信号打断和真正失败，需要不同的恢复策略。"],
    ],
    trace: [
      ["打开", "open 让内核创建文件表项，并返回当前进程可用的描述符。"],
      ["传输", "read / write 在用户缓冲区与内核对象间复制字节，返回实际数量。"],
      ["关闭", "close 释放一个描述符引用；只有最后的引用消失，底层对象才可真正清理。"],
    ],
    code: 'char buf[4096];\nssize_t n;\nwhile ((n = read(STDIN_FILENO, buf, sizeof buf)) > 0) {\n  if (write(STDOUT_FILENO, buf, (size_t)n) != n)\n    return 1;\n}',
    caption: "这是一个极简的 cat。它仍不够健壮：write 也可能只写一部分，正好是继续练习的入口。",
    memory: [
      ["心智模型", "描述符是一张前台取号牌：号码很小，背后连接的对象和状态却在内核里。"],
      ["常见误区", "假设 read(n) 就一定得到 n 个字节，或忘记 close 导致资源泄漏。"],
      ["动手试试", "用管道连接两个进程，观察读端在所有写端关闭后才读到 EOF。"],
    ],
  },
  {
    id: 11,
    title: "网络编程",
    slug: "Processes talking across an unreliable distance",
    tags: ["Socket", "TCP", "协议", "并发服务器", "DNS"],
    summary: "网络把本地 I/O 的模型延伸到了另一台机器。套接字 API 保持熟悉，但延迟、断连、字节序和协议边界会提醒你：远方从来不是一个普通文件。",
    concepts: [
      ["地址标识端点", "IP 找到主机，端口找到主机上的服务；DNS 负责把名字翻译成可路由的地址。"],
      ["TCP 提供字节流", "它保证有序、可靠的字节序列，却不替你的应用划分消息。"],
      ["客户端先连接", "connect 发起到服务端监听端点的连接；服务端 accept 取得专属通信描述符。"],
      ["协议要明确", "长度前缀、分隔符或固定格式都可以，关键是双方对边界达成一致。"],
    ],
    trace: [
      ["监听", "服务器 socket、bind、listen，把一个端口变成等待连接的入口。"],
      ["建立", "三次握手完成后，accept 返回新的连接描述符，监听描述符仍可继续接客。"],
      ["对话", "应用在连接上读写字节，直到一方关闭或网络让这段关系中断。"],
    ],
    code: 'int clientfd = accept(listenfd, NULL, NULL);\nchar line[1024];\nssize_t n = read(clientfd, line, sizeof line);\nif (n > 0)\n  write(clientfd, "ok\\n", 3);\nclose(clientfd);',
    caption: "accept 得到的是“这位客户”的连接，不是监听入口本身。并发服务器的设计从这里开始分岔。",
    memory: [
      ["心智模型", "网络协议是隔着雾传纸条：可靠传送不等于对方自动知道一句话何时结束。"],
      ["常见误区", "以为一次 send 对应一次 recv，或只在本机测试后就假定网络没有失败模式。"],
      ["动手试试", "用 nc 连接一个本地服务端，故意分两次输入一条消息。"],
    ],
  },
  {
    id: 12,
    title: "并发编程",
    slug: "Many flows of control, one shared reality",
    tags: ["线程", "竞态", "互斥锁", "信号量", "线程池"],
    summary: "并发让多个控制流重叠推进，也让“看起来只有一行”的代码失去原子性。正确的并发程序需要明确共享状态、同步规则和对象生命周期。",
    concepts: [
      ["并发不等于并行", "任务在时间上交错是并发；真正同时运行需要多个硬件执行资源。"],
      ["竞态来自交错", "结果取决于线程调度顺序时，程序就不再能靠单次运行证明正确。"],
      ["锁保护不变量", "互斥锁不是给变量上锁，而是让某组必须一起成立的条件不被中途看见。"],
      ["生命周期同样重要", "谁创建、谁等待、谁释放？很多并发 bug 是资源结束得太早或太晚。"],
    ],
    trace: [
      ["划定共享", "先写出哪些数据跨线程可见，哪些操作必须作为一个不可分割的临界区。"],
      ["选择同步", "互斥、条件变量、信号量、消息队列各自解决不同的等待和所有权问题。"],
      ["验证交错", "用小输入、高重复次数和工具制造更多调度机会，而不是祈祷它刚好复现。"],
    ],
    code: 'pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;\nlong total = 0;\n\nvoid add_one(void) {\n  pthread_mutex_lock(&lock);\n  total++;\n  pthread_mutex_unlock(&lock);\n}',
    caption: "total++ 实际上包含读、改、写。锁的作用是把这段更新和它保护的不变量绑定在一起。",
    memory: [
      ["心智模型", "并发像多人共编一份文档：同步规则决定别人会看到半句、完整句，还是互相覆盖。"],
      ["常见误区", "以为加锁一定解决问题；锁的粒度、顺序和等待条件同样会制造死锁与性能瓶颈。"],
      ["动手试试", "先移除锁反复运行计数器，再用线程 sanitizers 或 helgrind 观察报告。"],
    ],
  },
];

const STORAGE = {
  theme: "csapp-codebook-theme",
  read: "csapp-codebook-read",
  current: "csapp-codebook-current-chapter",
};

const state = {
  currentId: readNumber(STORAGE.current, 1),
  query: "",
  filter: "all",
  read: new Set(readJson(STORAGE.read, [])),
};

if (!CHAPTERS.some((chapter) => chapter.id === state.currentId)) state.currentId = 1;

const els = {
  chapterNav: document.querySelector("#chapterNav"),
  chapterReader: document.querySelector("#chapterReader"),
  searchInput: document.querySelector("#searchInput"),
  chapterVisibleCount: document.querySelector("#chapterVisibleCount"),
  progressNumber: document.querySelector("#progressNumber"),
  progressText: document.querySelector("#progressText"),
  themeToggle: document.querySelector("#themeToggle"),
};

function boot() {
  applyStoredTheme();
  bindEvents();
  render();
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderNav();
  });

  document.querySelector(".filter-group").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    renderNav();
  });

  els.chapterNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chapter]");
    if (!button) return;
    selectChapter(Number(button.dataset.chapter), true);
  });

  els.chapterReader.addEventListener("click", async (event) => {
    const readButton = event.target.closest("[data-toggle-read]");
    if (readButton) {
      toggleRead(state.currentId);
      return;
    }

    const copyButton = event.target.closest("[data-copy]");
    if (copyButton) {
      await copyCurrentCode(copyButton);
      return;
    }

    const navButton = event.target.closest("[data-nav]");
    if (navButton) selectChapter(Number(navButton.dataset.nav), true);
  });

  els.themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(STORAGE.theme, next);
    els.themeToggle.innerHTML = iconMarkup(next === "dark" ? "sun" : "moon");
    refreshIcons();
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.matches("input, textarea, select")) return;
    if (event.key === "[") moveChapter(-1);
    if (event.key === "]") moveChapter(1);
  });
}

function render() {
  renderProgress();
  renderNav();
  renderReader();
  refreshIcons();
}

function renderProgress() {
  const count = state.read.size;
  els.progressNumber.textContent = String(count);
  els.progressText.textContent = `${count} / ${CHAPTERS.length}`;
}

function renderNav() {
  const chapters = filteredChapters();
  els.chapterVisibleCount.textContent = String(chapters.length);
  els.chapterNav.innerHTML = chapters
    .map((chapter) => {
      const isRead = state.read.has(chapter.id);
      const isCurrent = chapter.id === state.currentId;
      return `
        <button class="chapter-button" type="button" data-chapter="${chapter.id}" aria-current="${isCurrent}">
          <span class="chapter-number">${String(chapter.id).padStart(2, "0")}</span>
          <span class="chapter-label">${escapeHtml(chapter.title)}</span>
          <span class="chapter-state ${isRead ? "is-read" : ""}" aria-label="${isRead ? "已读" : "未读"}">
            ${isRead ? iconMarkup("check") : ""}
          </span>
        </button>
      `;
    })
    .join("");
  refreshIcons();
}

function renderReader() {
  const chapter = getCurrentChapter();
  const isRead = state.read.has(chapter.id);
  const previous = CHAPTERS[chapter.id - 2];
  const next = CHAPTERS[chapter.id];

  els.chapterReader.innerHTML = `
    <section class="chapter-intro">
      <p class="chapter-index">CHAPTER ${String(chapter.id).padStart(2, "0")}</p>
      <div class="chapter-title-row">
        <div>
          <h2 class="chapter-title">${escapeHtml(chapter.title)}</h2>
          <p class="chapter-slug">${escapeHtml(chapter.slug)}</p>
        </div>
        <button class="chapter-status ${isRead ? "is-read" : ""}" type="button" data-toggle-read aria-pressed="${isRead}">
          ${iconMarkup(isRead ? "check-circle-2" : "circle")}
          <span>${isRead ? "已读完" : "标为读完"}</span>
        </button>
      </div>
      <p class="chapter-summary">${escapeHtml(chapter.summary)}</p>
      <div class="tag-row" aria-label="本章标签">
        ${chapter.tags.map((tag) => `<span class="tag"># ${escapeHtml(tag)}</span>`).join("")}
      </div>
    </section>

    <section class="reader-section" aria-labelledby="concept-title">
      <h2 class="section-title" id="concept-title"><span>01</span> 本章抓手</h2>
      <div class="concept-grid">
        ${chapter.concepts
          .map(
            ([title, body], index) => `
              <article class="concept-card">
                <span class="concept-no">0${index + 1}</span>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(body)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="reader-section" aria-labelledby="trace-title">
      <h2 class="section-title" id="trace-title"><span>02</span> 顺着它走一遍</h2>
      <div class="trace-list">
        ${chapter.trace
          .map(
            ([title, body], index) => `
              <div class="trace-item">
                <span class="trace-index">${index + 1}</span>
                <div class="trace-copy"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="reader-section" aria-labelledby="lab-title">
      <h2 class="section-title" id="lab-title"><span>03</span> 代码切片</h2>
      <div class="code-lab">
        <div class="code-lab-top">
          <span class="code-lab-label"><i></i> ${chapter.id === 9 ? "memory-map.c" : "system-note.c"}</span>
          <button class="copy-button" type="button" data-copy><i data-lucide="copy"></i><span>复制代码</span></button>
        </div>
        <pre class="code-pre"><code>${escapeHtml(chapter.code)}</code></pre>
        <p class="code-caption"><strong>TRY IT</strong>　${escapeHtml(chapter.caption)}</p>
      </div>
    </section>

    <section class="reader-section" aria-labelledby="memory-title">
      <h2 class="section-title" id="memory-title"><span>04</span> 带走三件事</h2>
      <div class="memory-grid">
        ${chapter.memory
          .map(
            ([label, body]) => `
              <article class="memory-card"><span>${escapeHtml(label)}</span><p>${escapeHtml(body)}</p></article>
            `,
          )
          .join("")}
      </div>
    </section>

    <nav class="reader-navigation" aria-label="上一章与下一章">
      ${navMarkup(previous, "上一章", "arrow-left")}
      ${navMarkup(next, "下一章", "arrow-right", true)}
    </nav>
  `;
  document.title = `${chapter.title} · CSAPP Codebook`;
  refreshIcons();
}

function navMarkup(chapter, label, icon, alignEnd = false) {
  if (!chapter) return `<button class="nav-chapter" type="button" disabled></button>`;
  return `
    <button class="nav-chapter" type="button" data-nav="${chapter.id}" ${alignEnd ? "" : ""}>
      <span>${iconMarkup(icon)} ${label}</span>
      <b>${escapeHtml(chapter.title)}</b>
    </button>
  `;
}

function filteredChapters() {
  return CHAPTERS.filter((chapter) => {
    const isRead = state.read.has(chapter.id);
    const matchesFilter = state.filter === "all" || (state.filter === "read" ? isRead : !isRead);
    const text = [chapter.title, chapter.slug, chapter.summary, ...chapter.tags, ...chapter.concepts.flat()]
      .join(" ")
      .toLowerCase();
    return matchesFilter && (!state.query || text.includes(state.query));
  });
}

function selectChapter(id, scrollOnMobile = false) {
  if (!CHAPTERS.some((chapter) => chapter.id === id)) return;
  state.currentId = id;
  localStorage.setItem(STORAGE.current, String(id));
  renderNav();
  renderReader();
  if (scrollOnMobile && window.innerWidth <= 680) {
    els.chapterReader.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function moveChapter(direction) {
  const nextId = Math.min(CHAPTERS.length, Math.max(1, state.currentId + direction));
  if (nextId !== state.currentId) selectChapter(nextId, true);
}

function toggleRead(id) {
  if (state.read.has(id)) {
    state.read.delete(id);
  } else {
    state.read.add(id);
  }
  localStorage.setItem(STORAGE.read, JSON.stringify([...state.read]));
  renderProgress();
  renderNav();
  renderReader();
}

async function copyCurrentCode(button) {
  const original = button.querySelector("span").textContent;
  const text = getCurrentChapter().code;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const temporary = document.createElement("textarea");
    temporary.value = text;
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.append(temporary);
    temporary.select();
    document.execCommand("copy");
    temporary.remove();
  }
  button.querySelector("span").textContent = "已复制";
  setTimeout(() => {
    if (button.isConnected) button.querySelector("span").textContent = original;
  }, 1500);
}

function getCurrentChapter() {
  return CHAPTERS.find((chapter) => chapter.id === state.currentId) || CHAPTERS[0];
}

function applyStoredTheme() {
  const stored = localStorage.getItem(STORAGE.theme);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  els.themeToggle.innerHTML = iconMarkup(theme === "dark" ? "sun" : "moon");
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readNumber(key, fallback) {
  const number = Number(localStorage.getItem(key));
  return Number.isInteger(number) ? number : fallback;
}

function iconMarkup(name) {
  return `<i data-lucide="${name}"></i>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

boot();
